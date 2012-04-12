function expose(exports) {
  return function() {
    var args = Array.prototype.slice.apply(arguments);
    if(args.length == 2 && typeof args[0] == 'string' && typeof args[1] == 'function') {
      exports[args[0]] = args[1];
    } else {
      for(var i = 0; i < args.length; i++) {
        var f = args[i];
        exports[f.name] = f;
      }
    }
  };
}

exports.expose = expose;