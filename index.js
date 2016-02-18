var BurnStream = require('burn-stream')
var Networks = require('bitcore-lib').Networks
var Node = require('webcoin').Node
var fs = require('fs')
var constants = require('webcoin').constants
const EventEmitter = require('events')
var inherits = require('inherits')

// Load our app config from JSON
var config = JSON.parse(fs.readFileSync('app-config.json'))

// Hackily set the node's checkpoint
constants.checkpoints[config.networkName] = BurnStream.checkpointToConstant(config.checkpoint)

// Create and start a node
var node = new Node({
  network: Networks[config.networkName],
  path: 'testdata',
  acceptWeb: true
})
node.on('error', console.log)
config.node = node
node.start()
function CatNames () {
  EventEmitter.call(this)

  this.names = {}

  var self = this

  // When we get some data, save it to the set
  var bs = BurnStream(config)
  bs.stream.on('data', function (data) {
    // Check the version byte
    if (data.message[0] !== 0) return

    // Put parsing code in a try/catch block so that malicious parties can't
    // crash our client!
    try {
      var names = JSON.parse(data.message.slice(1).toString('utf8'))
      names.forEach(function (name) {
        self.names[name] = true
        self.emit('name', name)
      })
    } catch (e) {
      self.emit('error', e)
    }
  })
}
inherits(CatNames, EventEmitter)

var names = new CatNames()
names.on('name', console.log)
names.on('error', console.log)
