var user = require('./user'),
    points = require('./points'),
    async = require('async');

function mark_playable(cb) {
  user.getAll(function(err, users) {
    if(err) {
      cb(err);
    } else {
      async.forEach(users, function(u, cb) {
        points.numKills(u, function(err, killCount) {
          user.setPlaying(u, killCount > 0, cb);
        });
      }, function(err) {
        cb(err);
      });
    }
  });
}

exports.mark_playable = mark_playable;