var fs = require('fs')
var assert = require('assert')
var argv = require('minimist')(process.argv.slice(2))
var Writer = require('burn-stream-writer')

// Load configuration from files
var appConfig = JSON.parse(fs.readFileSync('app-config.json'))
var clientConfig = JSON.parse(fs.readFileSync('client-config.json'))

// Prepare the writing options. Here we include the version prefix.
var namesBuffer = Buffer(JSON.stringify(argv._), 'utf8')
var message = Buffer.concat(Buffer([0]), namesBuffer)
var opts = {
  amount: 10000,
  message: message.toString('hex')
}

// Write
var writer = Writer(clientConfig, appConfig)

writer.make(opts, function (err, tx) {
  assert.ifError(err)

  if (argv['dry-run']) {
    console.log('tx hex', tx.hex)
    console.log('not sending')
  } else {
    writer.send(tx.hex, function (err) {
      assert.ifError(err)
      console.log('write submitted successfully')
    })
  }
})
