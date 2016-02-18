The world's first decentralized cat name database
=================================================

In this post, I'll show you how to build a client for the world's first decentralized cat name database. This will be a censorship- and spam-resistant set of cat names which anyone can write to, without an account.

First, I'll break down the requirements. For some more theory on this, see [World-writable data structures by burning bitcoins](http://paulkernfeld.com/2016/02/19/world-writable.html).

- Singleton: There should be a single set of cat names that is shared by everyone in the world.
- World-writable: Anyone should be able to write to this set, without any sort of account.
- Censorship-resistant: It should not be possible to censor particular cat names from the set.
- Spam-resistant: The set should not be filled with junk content.

The code for this blog post is available at [paulkernfeld/decentralized-cat-names](https://github.com/paulkernfeld/decentralized-cat-names) on GitHub. This post is a literate program written with [litpro](https://github.com/jostylr/litpro).

Setup
-----
As the backbone for this project, we'll use the [burn-stream](https://github.com/paulkernfeld/burn-stream) node.js library. If you're having trouble with any part of this project, or if you want to understand more about what's going on under the hood, check out the burn-stream documentation on GitHub.

To get started, run `npm install burn-stream webcoin bitcore-lib`.

There's a lot of data in the Bitcoin blockchain, so we need some way to identify the relevant data for our particular application. Here's a config file that we can use; let's save it to [app-config.json](#Setup "save:"). Of course, you can modify this if you want to make your own data structure.

```json
{
    "networkName": "testnet",
    "burnAddress": "mvCatNamesXXXXXXXXXXXXXXXXXXcgSA6W",
    "opReturnPrefix": "63617473",
    "checkpoint": {
        "height": 716400,
        "header": {
            "version": 4,
            "prevHash": "00000000000090c5154b1e17d0a9fd2d4727d302cf680ee7a4ad4fac353c0cd1",
            "merkleRoot": "45fc593653771e59e22b9a14761b53b5958b24a171c9aeb7a55ee3017c7d3964",
            "time": 1455881969,
            "bits": 453246972,
            "nonce": 4147662168
        }
    }
}
```

Reading
-------
Everything in this section is part of a single Javascript file; let's save it in [index.js](#Reading "save:")

In order to run burn-stream, we need a running [webcoin](https://github.com/mappum/webcoin) Node. The only tricky part of this process is that we need to patch it in order to insert our own checkpoint; soon there should be a better interface for doing this.

If you want to see more logs, try setting the env var `DEBUG` to `*` (see [visionmedia/debug](https://github.com/visionmedia/debug)).

```javascript
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
```

Now that we have a working node, it's easy to make an instance of `BurnStream`. Each message in the stream will contain a version byte, `0x00`, which will allow us to make future enhancements to our cat name storage protocol without breaking existing clients. The cat names will be stored as a JSON array. Here we'll make a class, `CatNames`, which emits `name` events.

```javascript
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
```

All right, there we go! This program will print out cat names as they are read in. Designing a better UI than `console.log` is left as an exercise to the reader.

Writing
-------
Writing is a little trickier than reading, since in order to write you actually need to spend some bitcoins. Fortunately, since our cat name database runs on the Bitcoin testnet, you only need testnet bitcoins, which you can easily get for free.

In this tutorial, we'll make a writing script and save it to [bin/write.js](#Writing "save:").

First, install [burn-stream-writer](https://github.com/paulkernfeld/burn-stream-writer) with npm and set it up using the instructions in its documentation. Save the client config to `client-config.json`.

Here's our writer script. It has a dry run feature which allows us to check the message before writing it to the blockchain.

```javascript
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
```

To invoke this we can run, for example, `node bin/write.js -- Tiger Snowball`.

When you run this, your message should be written to the cat database so that everyone can see it.

Possible enhancements
---------------------
The database, as currently designed, is vulnerable to spam. If spam becomes a problem, we could add a delete operation to our set.

We are also not considering the weight associated with each cat name. We could turn our set into a weighted set, where each name is weighted with the amount of bitcoins burned for it. This would help us to build a ranking of which cat names are more popular.

Now what?
---------
A cat database, while compelling, somehow feels like a frivolous use of this technology. My hope is that this tutorial gives you some ideas for your own decentralized data structures. Please feel free to email or tweet at me if you have any questions, or if you'd like to share what you've made.
