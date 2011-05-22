
/**
 * Module dependencies.
 */

/**
 * MongooseNumber constructor.
 *
 * @param {Object} value to pass to Number
 * @param {Document} parent document
 * @api private
 */

function MongooseNumber (value, path, doc) {
  var number = new Number(value);
  number.__proto__ = MongooseNumber.prototype;
  number._atomics = {};
  number._path = path;
  number._parent = doc;
  return number;
};

/**
 * Inherits from Number.
 */

MongooseNumber.prototype = new Number();

/**
 * Atomic increment
 *
 * @api public
 */

MongooseNumber.prototype.increment = function(value){
  var schema = this._parent.schema.path(this._path)
    , value = Number(value) || 1;
  if (isNaN(value)) value = 1;
  this._parent.setValue(this._path, schema.cast(this + value));
  this._parent.getValue(this._path)._atomics['$inc'] = value || 1;
  this._parent.getValue(this._path)._parent = this._parent;
  this._parent.activePaths.modify(this._path);
  return this;
};

/**
 * Returns true if we have to perform atomics for this, and no normal
 * operations
 *
 * @api public
 */

MongooseNumber.prototype.__defineGetter__('doAtomics', function () {
  return Object.keys(this._atomics).length;
});

/**
 * Atomic decrement
 *
 * @api public
 */

MongooseNumber.prototype.decrement = function(){
  this.increment(-1);
};

/**
 * Re-declare toString (for `console.log`)
 *
 * @api public
 */

MongooseNumber.prototype.inspect =
MongooseNumber.prototype.toString = function () {
  return String(this.valueOf());
};


/**
 * Module exports
 */

MongooseNumber.prototype.sync = function(callback){
  var schema = this._parent.schema.path(this._path)
    , self = this
    , query = {_id: self._parent._id}
    , fields = {};
  
  fields[self._path] = 1;
  
  self._parent.collection.findOne(query, fields, function(err, obj) {
    if (err) return callback(err);
    if (typeof(obj) != 'undefined') {
      self._parent.setValue(self._path, schema.cast(obj[self._path]));
      self._parent.getValue(self._path)._parent = self._parent;
      self = self._parent.getValue(self._path);
      callback(null);
    } else {
      callback(new Error('Sync document missing'));
    }
  });
}

/**
 * Atomic inc
 *
 * @api public
 */

MongooseNumber.prototype.inc = function(value, min, max, callback){
  var schema = this._parent.schema.path(this._path)
    , value = Number(value) || 1;

  if (isNaN(value)) value = 1;

  if (typeof(min) == 'function') {
    callback = min;
    min = NaN;
    max = NaN;
  } else if (typeof(max) == 'function') {
    callback = max;
    max = min;
    min = NaN;
  }
  
  var min = min == null ? NaN : Number(min)
    , max = max == null ? NaN : Number(max);

  var self = this
    , ov = self.valueOf()
    , uv = ov + value
    , delta = 0
    , query = {_id: self._parent._id}
    , set = {};

  if (!isNaN(min) && uv < min)
    uv = min;

  if (!isNaN(max) && uv > max)
    uv = max;
    
  delta = uv - ov;
    
  query[self._path] = ov;  
  set[self._path] = delta;
  
  self._parent.collection.findAndModify(query, [], {$inc: set}, {'new': true}, function(err, obj) {
    if (err) return callback(err);
    if (typeof(obj) != 'undefined') {
      self._parent.setValue(self._path, schema.cast(obj[self._path]));
      self._parent.getValue(self._path)._parent = self._parent;
      self = self._parent.getValue(self._path);
      callback(null);
    } else {
      self.sync(function(err) {
        if (err) return callback(err);
        self = self._parent.getValue(self._path);
        self.inc(value, min, max, callback);
      });
    }
  });
};

/**
 * Atomic dec
 *
 * @api public
 */

MongooseNumber.prototype.dec = function(value, callback){
  var schema = this._parent.schema.path(this._path)
    , value = Number(value) || 1;

  if (isNaN(value)) value = 1;

  var self = this
    , ov = self.valueOf()
    , query = {_id: self._parent._id}
    , set = {};

  query[self._path] = {$gte: value};    
  set[self._path] = -value;
  
  self._parent.collection.findAndModify(query, [], {$inc: set}, {'new': true}, function(err, obj) {
    if (err) return callback(err, false);
    if (typeof(obj) != 'undefined') {
      self._parent.setValue(self._path, schema.cast(obj[self._path]));
      self._parent.getValue(self._path)._parent = self._parent;
      self = self._parent.getValue(self._path);
      callback(null, true);
    } else {
      callback(null, false);
    }
  });
};

module.exports = MongooseNumber;
