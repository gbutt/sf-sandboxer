(function(){
'use strict';

var path = require('path');
var jsforce = require('jsforce');
var _ = require('lodash');
var program = require('commander');
var packageJson = require('./package.json');

program
  .version(packageJson.version)
  .option('-p, --src-password [srcPassword]', 'Password for source org. Also works for dest org if they are the same.')
  .option('--dest-password [destPassword]', 'Password for dest org, if different from source org.')
  .option('-c, --config [file]', 'config file', 'configs/new-sandbox.json')
  .parse(process.argv);


var config = require(path.resolve(program.config));
var vars = config.variables;

config.src.password = program.srcPassword;
config.dest.password = program.destPassword || program.srcPassword;

run();

function run() {
  createConnections(config)
  .then(function(conns){
    config.srcConn = conns.srcConn;
    config.destConn = conns.destConn;

    // execute loaders synchronously
    var promise = Promise.resolve(undefined);
    for (var idx = 0; idx < config.loaders.length; idx++) {
      (function(idx) {
        var loaderConf = config.loaders[idx];
        if (loaderConf.enabled) {
          promise = promise.then(function(){
            return importData(loaderConf);
          });
        }
      })(idx);
    }
    return promise;
  })
  .then(function(){
    console.log('Done.');
  })
  .catch(function(err) {
    console.error(err);
  });
}

function createConnections(config) {
  var _srcConn = new jsforce.Connection({loginUrl: config.src.loginUrl});
  var _destConn = new jsforce.Connection({loginUrl: config.dest.loginUrl});
  return Promise.all([
    _srcConn.login(config.src.username, config.src.password), 
    _destConn.login(config.dest.username, config.dest.password)
  ]).then(function(){

    return {
      srcConn : {
        // only expose query api for source connection
        query: function(soql, options, callback) {
          return _srcConn.query(soql, options, callback);
        }
      }, 
      destConn : _destConn
    };
  });
}

function importData(loaderConf) {
  var soql = 'SELECT ' + loaderConf.fields.join(', ') + ' FROM ' + loaderConf.type;
  // replace $VAR_NAME with variables
  if (!!loaderConf.filter) {
    var filter = loaderConf.filter;
    Object.keys(vars).forEach(function(key){
      if (filter.indexOf('$'+key) > -1) {
        filter = filter.replace('$'+key, vars[key]);
      }
    })
    soql += " WHERE " + filter;
  }
  
  var promise = Promise.resolve(undefined);
  // preload - query source org and set variables
  return promise.then(function(){
      // preload
      return;
  }).then(function(){
    // fetch records from src org
    console.log('Fetching ' + loaderConf.type);
    return queryDeep(config.srcConn, soql);
  }).then(function(records){
    console.log('Fetched ' + records.length + ' ' + loaderConf.type);
    // prepare records for bulk load
    var records = flattenRecords(loaderConf.fields, records);
    mapFields(loaderConf.mappings, records);
    removeIds(records);
    removeNulls(records);
    config.destConn.bulk.pollTimeout = 5*60*1000;
    var deferred = [];
    // bulk load records into dest org
    _.chunk(records, 10000).forEach(function(batch){
      deferred.push(config.destConn.bulk.load(loaderConf.type, loaderConf.operation, loaderConf.options, batch));
    })
    return Promise.all(deferred);
  }).then(function(results) {
    // log results
    results = _.flatten(results);
    var successes = _.countBy(results, 'success');
    results.forEach(function(result, idx){
      if (!result.success){
        console.log('#' + (idx+1) + ' error occurred, message = ' + result.errors.join(', '));
      }
    });
    console.log(successes[true] + ' loaded, ' + (successes[false] | 0) + ' failed');
  }).then(function(){
    // postLoad - query dest org and set new variables
    return;
  });
}

function queryDeep(conn, soql) {
  return new Promise(function(resolve, reject) {
    var records = [];
    conn.query(soql)
      .on('record', function(record) {
        records.push(record);
      })
      .on('end', function(){
        resolve(records);
      })
      .on('error', function(err){
        reject(err);
      })
      .run({ autoFetch: true, maxFetch: 50000 });
  });
}

function flattenRecords(fields, records) {
  return _.map(records, function(record){
    var normalizedRecord = {};
    fields.forEach(function(field) {
      normalizedRecord[field] = _.get(record, field);
    });
    return normalizedRecord;
  });
}

function mapFields(mappings, records) {
  if (!mappings) return;
  mappings.forEach(function(mapping) {
    records.forEach(function(record) {
      if (!!mapping.srcField) {
        record[mapping.destField] = record[mapping.srcField];
      } else if (!!mapping.srcValue) {
        record[mapping.destField] = mapping.srcValue;
      }
    });
  });
}

function removeIds(records) {
  records.forEach(function(record) {
    delete record.Id;
  })
}

function removeNulls(records) {
  records.forEach(function(record){
    Object.keys(record).forEach(function(key){
      if (record[key] === undefined || record[key] === null) {
        delete record[key];
      }
    })
  })
}

})();