import {EventEmitter} from "events";
import * as net from "net";
import * as tls from 'tls';
import * as fs from 'fs';

export function createTcpServer(relayPort, internetPort, options) {
  if (options === undefined) {
    options = {
      tls: false,
      pfx: "../../cert.pfx",
      passphrase: "abcd"
    };
  }
  return new TcpServer(relayPort, internetPort, options);
}

export class TcpServer {
  options;
  relayPort;
  internetPort;
  relayListener;
  internetListener;

  constructor(relayPort, internetPort, options) {
    this.options = options || {};
    this.relayPort = relayPort;
    this.internetPort = internetPort;
    this.relayListener = new Listener(relayPort, {
      hostname: options.hostname,
      secret: options.secret,
      bufferData: !!options.secret,
      tls: options.tls !== false,
      pfx: options.pfx,
      passphrase: options.passphrase
    });
    this.internetListener = new Listener(internetPort, {
      hostname: options.hostname,
      bufferData: true,
      timeout: 20000,
      tls: options.tls === "both",
      pfx: options.pfx,
      passphrase: options.passphrase
    });

    const server = this;
    this.relayListener.on("new", client => {
      server.internetListener.pair(server.relayListener, client);
    });
    this.internetListener.on("new", client => {
      server.relayListener.pair(server.internetListener, client);
    });
  }

  end() {
    this.relayListener.end();
    this.internetListener.end();
  };
}

class Listener extends EventEmitter {
  port: number;
  options: any;
  pending;
  active;
  server;

  constructor(port, options) {
    super();
    this.port = port;
    this.options = options || {};
    this.pending = [];
    this.active = [];

    const listener = this;
    if (listener.options.tls === true) {
      const tlsOptions = {
        pfx: fs.readFileSync(listener.options.pfx),
        passphrase: listener.options.passphrase
      };
      this.server = tls.createServer(tlsOptions, socket => {
        listener.createClient(socket);
      });
    } else {
      this.server = net.createServer(socket => {
        listener.createClient(socket);
      });
    }
    this.server.listen(port, options.hostname);
  }


  createClient(socket) {
    const listener = this;
    const client = new Client(socket, {
      secret: listener.options.secret,
      bufferData: listener.options.bufferData,
      timeout: listener.options.timeout
    });
    client.on("close", () => {
      let i = listener.pending.indexOf(client);
      if (i != -1) {
        listener.pending.splice(i, 1);
      } else {
        i = listener.active.indexOf(client);
        if (i != -1) {
          listener.active.splice(i, 1);
        }
      }
    });
    if (listener.options.secret) {
      client.on("authorized", () => {
        listener.emit("new", client);
      });
    } else {
      listener.emit("new", client);
    }
  };

  end() {
    this.server.close();
    for (var i = 0; i < this.pending.length; i++) {
      var client = this.pending[i];
      client.socket.destroy();
    }
    for (var i = 0; i < this.active.length; i++) {
      var client = this.active[i];
      client.socket.destroy();
    }
    this.server.unref();
  };

  pair({active, pending}, client) {
    if (this.pending.length > 0) {
      const thisClient = this.pending[0];
      this.pending.splice(0, 1);
      client.pairedSocket = thisClient.socket;
      thisClient.pairedSocket = client.socket;
      this.active[this.active.length] = thisClient;
      active[active.length] = client;
      client.writeBuffer();
      thisClient.writeBuffer();
    } else {
      pending.push(client);
    }
  };

}

class Client extends EventEmitter {

  socket;
  options;
  buffer;
  pairedSocket;

  constructor(socket, options) {
    super();
    this.socket = socket;
    this.options = options || {};
    if (options.bufferData) {
      this.buffer = [];
    }
    this.pairedSocket = undefined;
    this.timeout();

    const client = this;
    client.socket.on("data", data => {
      if (client.options.bufferData) {
        client.buffer[client.buffer.length] = data;
        client.authorize();
        return;
      }
      try {
        client.pairedSocket.write(data);
      } catch (ex) {
      }
    });
    socket.on("close", err => {
      if (client.pairedSocket != undefined) {
        client.pairedSocket.destroy();
      }
      client.emit("close");
    });
    socket.on("error", err => {
      client.emit("close");
    });
  }


  timeout() {
    const client = this;
    if (!client.options.timeout) {
      return;
    }
    setTimeout(() => {
      if (client.options.bufferData) {
        client.socket.destroy();
        client.emit("close");
      }
    }, client.options.timeout);
  };

  authorize() {
    const client = this;
    if (client.options.secret) {
      const keyLen = client.options.secret.length;
      if (client.buffer[0].length >= keyLen
        && client.buffer[0].toString(undefined, 0, keyLen)
        === client.options.secret) {
        client.buffer[0] = client.buffer[0].slice(keyLen);
        client.emit("authorized");
      } else {
        client.socket.destroy();
      }
    }
  };

  writeBuffer() {
    if (this.options.bufferData && this.buffer.length > 0) {
      try {
        for (let i = 0; i < this.buffer.length; i++) {
          this.pairedSocket.write(this.buffer[i]);
        }
      } catch (ex) {
      }
      this.buffer.length = 0;
    }
    this.options.bufferData = false;
  };
}
