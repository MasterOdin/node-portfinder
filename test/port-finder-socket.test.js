/*
 * portfinder-test.js: Tests for the `portfinder` module.
 *
 * (C) 2011, Charlie Robbins
 *
 */

"use strict";

const net = require('net'),
      path = require('path'),
      _async = require('async'),
      portfinder = require('../lib/portfinder'),
      fs = require('fs');

const servers = [],
      socketDir = path.join(__dirname, 'fixtures'),
      badDir = path.join(__dirname, 'bad-dir');

function createServers (callback) {
  let base = 0;

  _async.whilst(
    function (cb) { cb(null, base < 5); },
    function (next) {
      const server = net.createServer(function () { }),
            name = base === 0 ? 'test.sock' : 'test' + base + '.sock';
      const socket = path.join(socketDir, name);
      let sock = socket;

      // shamelessly stolen from foreverjs,
      // https://github.com/foreverjs/forever/blob/6d143609dd3712a1cf1bc515d24ac6b9d32b2588/lib/forever/worker.js#L141-L154
      if (process.platform === 'win32') {
        //
        // Create 'symbolic' file on the system, so it can be later
        // found via "forever list" since the `\\.pipe\\*` "files" can't
        // be enumerated because ... Windows.
        //
        fs.openSync(sock, 'w');

        //
        // It needs the prefix, otherwise EACCESS error happens on Windows
        // (no .sock extension, only named pipes with .pipe prefixes)
        //
        sock = '\\\\.\\pipe\\' + sock;
      }

      server.listen(sock, next);
      base++;
      servers.push([server, socket]);
    }, callback);
}

function stopServers(callback) {
  _async.each(servers, function ([server, socket], next) {
    server.close(function () {
      if (process.platform === 'win32' && fs.existsSync(socket)) {
        fs.unlinkSync(socket);
      }
      next();
    });
  }, callback);
}

function cleanup(callback) {
  if (fs.existsSync(path.join(badDir, 'deeply', 'nested'))) {
    fs.rmdirSync(path.join(badDir, 'deeply', 'nested'));
  }
  if (fs.existsSync(path.join(badDir, 'deeply'))) {
    fs.rmdirSync(path.join(badDir, 'deeply'));
  }
  if (fs.existsSync(badDir)) {
    fs.rmdirSync(badDir);
  }
  stopServers(callback);
}

describe('portfinder', function () {
  beforeAll(function (done) {
    cleanup(done);
  });

  afterAll(function (done) {
    cleanup(done);
  });

  describe('with 5 existing servers', function () {
    beforeAll(function (done) {
      createServers(done);
    });

    afterAll(function (done) {
      stopServers(done);
    });

    describe.each([
      ['getSocket()', false, portfinder.getSocket],
      ['getSocket()', true, portfinder.getSocket],
      ['getSocketPromise()', true, portfinder.getSocketPromise],
    ])(`the %s method (promise: %p)`, function (name, isPromise, method) {
      test('should respond with the first free socket (test5.sock)', function (done) {
        if (isPromise) {
          method({
            path: path.join(socketDir, 'test.sock')
          })
            .then(function (socket) {
              expect(socket).toEqual(path.join(socketDir, 'test5.sock'));
              done();
            })
            .catch(function (err) {
              done(err);
            });
        } else {
          method({
            path: path.join(socketDir, 'test.sock'),
          }, function (err, socket) {
            if (err) {
              done(err);
              return;
            }
            expect(err).toBeNull();
            expect(socket).toEqual(path.join(socketDir, 'test5.sock'));
            done();
          });
        }
      });
    });
  });

  describe('with no existing servers', function () {
    describe.each([
      ['getSocket()', false, portfinder.getSocket],
      ['getSocket()', true, portfinder.getSocket],
      ['getSocketPromise()', true, portfinder.getSocketPromise],
    ])(`the %s method (promise: %p)`, function (name, isPromise, method) {
      test("with a directory that doesn't exist should respond with the first free socket (test.sock)", function (done) {
        if (isPromise) {
          method({
            path: path.join(badDir, 'test.sock'),
          })
            .then(function (socket) {
              expect(socket).toEqual(path.join(badDir, 'test.sock'));
              done();
            })
            .catch(function (err) {
              done(err);
            });
        } else {
          method({
            path: path.join(badDir, 'test.sock'),
          }, function (err, socket) {
            if (err) {
              done(err);
              return;
            }
            expect(err).toBeNull();
            expect(socket).toEqual(path.join(badDir, 'test.sock'));
            done();
          });
        }
      });

      test("with a nested directory that doesn't exist should respond with the first free socket (test.sock)", function (done) {
        if (isPromise) {
          method({
            path: path.join(badDir, 'deeply', 'nested', 'test.sock'),
          })
            .then(function (socket) {
              expect(socket).toEqual(path.join(badDir, 'deeply', 'nested', 'test.sock'));
              done();
            })
            .catch(function (err) {
              done(err);
            });
        } else {
          method({
            path: path.join(badDir, 'deeply', 'nested', 'test.sock'),
          }, function (err, socket) {
            expect(err).toBeNull();
            expect(socket).toEqual(path.join(badDir, 'deeply', 'nested', 'test.sock'));
            done();
          });
        }
      });

      // We don't use `test.sock` here due to some race condition on Windows in freeing the `test.sock` file
      // when we close the servers.
      test('with a directory that exists should respond with the first free socket (foo.sock)', function (done) {
        if (isPromise) {
          method({
            path: path.join(socketDir, 'foo.sock'),
          })
            .then(function (socket) {
              expect(socket).toEqual(path.join(socketDir, 'foo.sock'));
              done();
            })
            .catch(function (err) {
              done(err);
            });
        } else {
          method({
            path: path.join(socketDir, 'foo.sock'),
          }, function (err, socket) {
            expect(err).toBeNull();
            expect(socket).toEqual(path.join(socketDir, 'foo.sock'));
            done();
          });
        }
      });
    });
  });
});
