var async = require('async'),
    mongodb = require('mongodb'),
    server = new mongodb.Server("localhost", mongodb.Connection.DEFAULT_PORT, {
      auto_reconnect: true
    }),
    db_connector = new mongodb.Db("bounty_hunters", server, {strict: true}),
    expose = require('./utils').expose(exports),
    events = require('events'),
    emitter = new events.EventEmitter();

var _db = null;
var collections = {};
var collectionNames = [
  'users'
];

db_connector.open(function(err, db) {
  if(err) {
    console.log(err);
  } else {
    _db = db;
    console.log("MongoDB: good to go!");
    emitter.emit("open");
  }
});

function dropCollections(cb) {
  async.parallel([
    function(cb) {
      _db.dropCollection("users", cb);
    }
  ], cb);
}

function getCollection(collection) {
  var args = Array.prototype.slice.apply(arguments),
      cb = null,
      setup = null;
  if(args.length == 3) {
    cb = args[2];
    setup = args[1];
  } else if(args.length == 2) {
    cb = args[1];
  }
  _db.collection(collection, function(err, c) {
    if(err) {
      _db.createCollection(collection, function(err, c) {
        if(!err && typeof setup == 'function') {
          setup(c, function(err) {
            cb(err, c);
          });
        } else {
          cb(err, c)
        }
      });
    } else {
      cb(err, c);
    }
  });
}

expose(dropCollections);
expose(getCollection);
exports.notifications = emitter;