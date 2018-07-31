import * as prog from "caporal";
import {createTcpServer} from "./server";

const pkg = require("../package.json");

export function run(argv) {
  prog
    .version(pkg.version)
    .description('Start sunnel server')
    .option("-r, --relay-port <relay-port>", "Relay port number", prog.INT, 9000, true)
    .option("-s, --service-port <service-port>", "Internet port number", prog.INT, undefined, true)
    .option("-h, --hostname [hostname]", "Name or IP address of host")
    .option("-k, --secret [key]", "Secret key required to be sent by relay client")
    .option("-t, --tls [both]", "Use TLS", undefined, false)
    .option("-c, --pfx [file]", "Private key file", prog.STRING, "cert.pfx")
    .option("-p, --passphrase [value]", "Passphrase to access private key file", prog.STRING, "abcd")
    .action((args, opts) => {
      const server = createTcpServer(opts.relayPort, opts.servicePort, opts);

      process.on("SIGINT", () => {
        server.end();
      });
    });

  prog.parse(argv);
}
