#!/usr/bin/env node

const {run} = require('../lib/cli');

process.on("uncaughtException", err => {
  console.error(err);
});

run(process.argv);
