/*
 * This file is part of the XCDL distribution 
 *   (http://xcdl.github.io).
 * Copyright (c) 2015 Liviu Ionescu.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict'

// --------------------------------------------------------------------------  
// Dependencies.  
const fs = require('fs')
const xml2js = require('xml2js')
const path = require('path')

// --------------------------------------------------------------------------  

// The module returns an object, with a method run().
// All other vars are local to this module.
var generateXpdsc = {}
module.exports = generateXpdsc

// --------------------------------------------------------------------------  

var inputPdsc

// --------------------------------------------------------------------------  

generateXpdsc.run = function (context, args, callback) {

  if (args.length < 5) {
    context.console.log('Usage:')
    context.console.log('  xcdl-js generate-xpdsc -i pdsc -o json')

    callback(null)
    return
  }

  context.console.log('Generate xpdsc.json from CMSIS .pdsc.')

  var inputPath
  var outputPath
  var i
  for (i = 1; i < args.length; ++i) {
    if (args[i] === '--ifile' || args[i] === '-i') {
      inputPath = args[i + 1]
      ++i
    } else if (args[i] === '--ofile' || args[i] === '-o') {
      outputPath = args[i + 1]
      ++i
    }
  }

  inputPdsc = path.basename(inputPath)
  try {
    var inputData = fs.readFileSync(inputPath, 'utf8')
  } catch (err) {
    // context.console.log(er.message)
    return callback(err)
  }
  context.console.log("'" + inputPath + "' read.")

  var parser = new xml2js.Parser()
  parser.parseString(inputData.substring(0, inputData.length), function (err,
    result) {

    var out = createRoot(result)
    var json = JSON.stringify(out, null, '\t')

    fs.writeFileSync(outputPath, json, 'utf8')
    context.console.log("'" + outputPath + "' written.")

    return callback(null)
  })
}

// ----------------------------------------------------------------------------

// TODO: process trace

var iterateArray = function (cnode, fn) {

  var nodes = []

  var i
  var len = cnode.length
  for (i = 0; i < len; ++i) {
    nodes.push(fn(cnode[i]))
  }

  return nodes
}

var createVendor = function (cnode) {

  var node = {}

  var sa = cnode.split(':')
  node.name = sa[0]
  node.id = parseInt(sa[1], 10)

  return node
}

var createRoot = function (cnode) {

  var node = {}

  node.$schema = 'http://xcdl.github.io/schemas/xpdsc-1-1.json'
  // node.id = 'http://xcdl.github.io/schemas/xpdsc-1-1.json'

  node.warning = 'DO NOT EDIT! Automatically generated from ' + inputPdsc
  node.generators = ['xcdl-js generate-xpdsc']

  cnode = cnode['package']
  node.vendorName = cnode.vendor[0]
  node.name = cnode.name[0]
  node.description = filterDescription(cnode.description[0])
  node.version = cnode.releases[0].release[0].$.version
  node.date = cnode.releases[0].release[0].$.date

  if (cnode.devices) {
    node.devices = iterateArray(cnode.devices[0].family, createFamily)
  }

  if (cnode.boards) {
    node.boards = iterateArray(cnode.boards[0].board, createBoard)
  }
  return node
}

var createFamily = function (cnode) {

  var node = {}

  node.name = cnode.$.Dfamily
  node.type = 'family'
  node.description = filterDescription(cnode.description)
  if (cnode.$.Dvendor) {
    node.vendor = createVendor(cnode.$.Dvendor)
  }

  if (cnode.compile) {
    node.compile = createCompile(cnode.compile[0])
  }

  if (cnode.processor) {
    node.processor = createProcessor(cnode.processor[0])
  }

  if (cnode.memory) {
    node.memorySections = iterateArray(cnode.memory, createMemory)
  }

  if (cnode.feature) {
    node.features = iterateArray(cnode.feature, createFeature)
  }

  if (cnode.debug) {
    node.debugOptions = iterateArray(cnode.debug, createDebug)
  }

  if (cnode.debugconfig) {
    node.debugConfigs = createDebugConfig(cnode.debug[0])
  }

  if (cnode.debugport) {
    node.debugPorts = iterateArray(cnode.debugport, createDebugPort)
  }

  var children = []
  if (cnode.subFamily) {
    children = children.concat(iterateArray(cnode.subFamily,
      createSubFamily))
  }

  if (cnode.device) {
    children = children.concat(iterateArray(cnode.device, createDevice))
  }

  if (children.length > 0) {
    node.children = children
  }

  return node
}

var createCompile = function (cnode) {

  var node = {}

  node.Pname = cnode.$.Pname
  node.header = filterPath(cnode.$.header)
  node.define = cnode.$.define

  return node
}

var createProcessor = function (cnode) {

  var node = {}

  node.Pname = cnode.$.Pname
  if (cnode.$.Dvendor) {
    node.vendor = createVendor(cnode.$.Dvendor)
  }
  node.core = cnode.$.Dcore
  node.coreVersion = cnode.$.DcoreVersion
  if (cnode.$.Dfpu) {
    if (cnode.$.Dfpu === '0') {
      node.fpu = 'NO_FPU'
    } else if (cnode.$.Dfpu === '1') {
      node.fpu = 'FPU'
    } else {
      node.fpu = cnode.$.Dfpu
    }
  }
  if (cnode.$.Dmpu) {
    if (cnode.$.Dmpu === '0') {
      node.mpu = 'NO_MPU'
    } else if (cnode.$.Dmpu === '1') {
      node.mpu = 'MPU'
    } else {
      node.mpu = cnode.$.Dmpu
    }
  }
  node.endian = cnode.$.Dendian
  if (cnode.$.Dclock) {
    node.clock = parseInt(cnode.$.Dclock, 10)
  }

  return node
}

var createDebug = function (cnode) {

  var node = {}

  node.Pname = cnode.$.Pname
  if (cnode.$.__dp) {
    node.__dp = parseInt(cnode.$.__dp, 10)
  }
  if (cnode.$.__ap) {
    node.__ap = parseInt(cnode.$.__ap, 10)
  }
  node.svd = filterPath(cnode.$.svd)

  return node
}

var createDebugPort = function (cnode) {

  var node = {}

  if (cnode.$.__dp) {
    node.__dp = parseInt(cnode.$.__dp, 10)
  }

  if (cnode.jtag) {
    node.jtag = {}

    if (cnode.jtag[0].$.tapindex) {
      node.jtag.tapindex = cnode.jtag[0].$.tapindex
    }
    if (cnode.jtag[0].$.idcode) {
      node.jtag.idcode = cnode.jtag[0].$.idcode
    }
    if (cnode.jtag[0].$.irlen) {
      node.jtag.irlen = parseInt(cnode.jtag[0].$.irlen, 10)
    }
  }

  if (cnode.swd) {
    node.swd = {}

    if (cnode.swd[0].$.idcode) {
      node.swd.idcode = cnode.swd[0].$.idcode
    }
  }

  if (cnode.cjtag) {
    node.cjtag = {}

    if (cnode.cjtag[0].$.tapindex) {
      node.cjtag.tapindex = cnode.cjtag[0].$.tapindex
    }
    if (cnode.cjtag[0].$.idcode) {
      node.cjtag.idcode = cnode.cjtag[0].$.idcode
    }
    if (cnode.cjtag[0].$.irlen) {
      node.cjtag.irlen = parseInt(cnode.cjtag[0].$.irlen, 10)
    }
  }

  return node
}

var createDebugConfig = function (cnode) {

  var node = {}

  node['default'] = cnode.$['default']
  if (cnode.$.clock) {
    node.clock = parseInt(cnode.$.clock, 10)
  }
  if (cnode.$.swj === "1") {
    node.swj = true
  }

  return node
}

var createSubFamily = function (cnode) {

  var node = {}

  node.name = cnode.$.DsubFamily
  node.type = 'subfamily'
  node.description = filterDescription(cnode.description)

  if (cnode.compile) {
    node.compile = createCompile(cnode.compile[0])
  }

  if (cnode.processor) {
    node.processor = createProcessor(cnode.processor[0])
  }

  if (cnode.memory) {
    node.memorySections = iterateArray(cnode.memory, createMemory)
  }

  if (cnode.feature) {
    node.features = iterateArray(cnode.feature, createFeature)
  }

  if (cnode.debug) {
    node.debugOptions = iterateArray(cnode.debug, createDebug)
  }

  if (cnode.debugconfig) {
    node.debugConfigs = createDebugConfig(cnode.debug[0])
  }

  if (cnode.debugport) {
    node.debugPorts = iterateArray(cnode.debugport, createDebugPort)
  }

  if (cnode.device) {
    node.children = iterateArray(cnode.device, createDevice)
  }

  return node
}

var createDevice = function (cnode) {

  var node = {}

  node.name = cnode.$.Dname
  node.type = 'device'
  node.description = filterDescription(cnode.description)

  if (cnode.compile) {
    node.compile = createCompile(cnode.compile[0])
  }

  if (cnode.processor) {
    node.processor = createProcessor(cnode.processor[0])
  }

  if (cnode.memory) {
    node.memorySections = iterateArray(cnode.memory, createMemory)
  }

  if (cnode.feature) {
    node.features = iterateArray(cnode.feature, createFeature)
  }

  if (cnode.debug) {
    node.debugOptions = iterateArray(cnode.debug, createDebug)
  }

  if (cnode.debugconfig) {
    node.debugConfigs = createDebugConfig(cnode.debug[0])
  }

  if (cnode.debugport) {
    node.debugPorts = iterateArray(cnode.debugport, createDebugPort)
  }

  if (cnode.variant) {
    node.children = iterateArray(cnode.variant, createVariant)
  }

  return node
}

var createMemory = function (cnode) {

  var node = {}

  node.Pname = cnode.$.Pname
  node.name = cnode.$.name
  node.id = cnode.$.id
  node.access = cnode.$.access
  node.start = cnode.$.start
  node.size = cnode.$.size
  if (cnode.$.startup === '1') {
    node.startup = true
  }
  if (cnode.$['default'] === '1') {
    node['default'] = true
  }
  node.alias = cnode.$.alias

  return node
}

var createVariant = function (cnode) {

  var node = {}

  node.name = cnode.$.Dvariant
  node.type = 'variant'
  node.description = filterDescription(cnode.description)

  if (cnode.feature) {
    node.features = iterateArray(cnode.feature, createFeature)
  }

  return node
}

var createFeature = function (cnode) {

  var node = {}

  node.Pname = cnode.$.Pname
  node.name = cnode.$.type

  switch (cnode.$.type) {
    case 'BGA':
    case 'CSP':
    case 'PLCC':
    case 'QFN':
    case 'QFP':
    case 'SOP':
    case 'DIP':
    case 'PackageOther':
      node.type = 'package'
      break

    case 'CAN':
    case 'ETH':
    case 'I2C':
    case 'I2S':
    case 'LIN':
    case 'SDIO':
    case 'SPI':
    case 'UART':
    case 'USART':
    case 'USBD':
    case 'USBH':
    case 'USBOTG':
      node.type = 'interface'
      break

    case 'XTAL':
    case 'IntRC':
    case 'RTC':
      node.type = 'clock'
      break

    default:
  }

  node.description = filterDescription(cnode.$.name)

  // n & m may be float
  if (cnode.$.n) {
    node.n = Number(cnode.$.n)
  }

  if (cnode.$.m) {
    node.m = Number(cnode.$.m)
  }

  return node
}

var createBoard = function (cnode) {

  var node = {}

  node.vendorName = cnode.$.vendor
  node.name = cnode.$.name
  node.revision = cnode.$.revision
  node.description = filterDescription(cnode.description)

  if (cnode.mountedDevice) {
    node.mountedDevices = iterateArray(cnode.mountedDevice,
      createBoardDevice)
  }

  if (cnode.compatibleDevice) {
    node.compatibleDevices = iterateArray(cnode.compatibleDevice,
      createBoardDevice)
  }

  if (cnode.debugInterface) {
    node.debugInterfaces = iterateArray(cnode.debugInterface,
      createBoardDebugInterface)
  }

  if (cnode.feature) {
    node.features = iterateArray(cnode.feature, createBoardFeature)
  }

  return node
}

var createBoardDevice = function (cnode) {

  var node = {}

  node.deviceIndex = cnode.$.deviceIndex
  if (cnode.$.Dvendor) {
    node.vendor = createVendor(cnode.$.Dvendor)
  }
  node.family = cnode.$.Dfamily
  node.subFamily = cnode.$.DsubFamily
  node.name = cnode.$.Dname

  return node
}

var createBoardDebugInterface = function (cnode) {

  var node = {}

  node.adapter = cnode.$.adapter
  node.connector = cnode.$.connector

  return node
}

var createBoardFeature = function (cnode) {

  var node = {}

  node.name = cnode.$.type
  node.description = filterDescription(cnode.$.name)

  // n & m may be float
  if (cnode.$.n) {
    node.n = Number(cnode.$.n)
  }
  if (cnode.$.m) {
    node.m = Number(cnode.$.m)
  }

  return node
}

// ----------------------------------------------------------------------------

var filterDescription = function (str) {

  if (!str) {
    return undefined
  }
  if (typeof str === 'object') {
    str = str[0]
  }
  return str.trim().replace(/\r\n/g, '\n')
}

var filterPath = function (str) {
  return str.replace(/\\/g, '/')
}
