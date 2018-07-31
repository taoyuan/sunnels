import * as program from "commander";
import {createTcpServer} from "./server";

const pkg = require("../package.json");

export function run(argv) {
  program
    .usage("[options]")
    .version(pkg.version)
    .option("-r, --relayPort <n>", "Relay port number", parseInt)
    .option("-s, --servicePort <n>", "Internet port number", parseInt)
    .option("-h, --hostname <host>", "Name or IP address of host")
    .option("-k, --secret [key]", "Secret key required to be sent by relay client")
    .option("-t, --tls [both]", "Use TLS", false)
    .option("-c, --pfx [file]", "Private key file", "cert.pfx")
    .option("-p, --passphrase [value]", "Passphrase to access private key file", "abcd")
    .parse(argv);

  const options = {
    hostname: program.hostname,
    secret: program.secret,
    tls: program.tls,
    pfx: program.pfx,
    passphrase: program.passphrase
  };

  const server = createTcpServer(program.relayPort, program.servicePort, options);

  process.on("SIGINT", () => {
    server.end();
  });

  return server;
}
