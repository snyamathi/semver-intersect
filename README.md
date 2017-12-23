# semver-intersect [![Build Status](https://travis-ci.org/snyamathi/semver-intersect.svg?branch=master)](https://travis-ci.org/snyamathi/semver-intersect) [![npm](https://img.shields.io/npm/v/semver-intersect.svg)](https://www.npmjs.com/package/semver-intersect)
Get the intersection of multiple semver ranges

```js
const { intersect } = require('semver-intersect');

// ^4.1.0
intersect('^4.0.0', '^4.1.0');

// ~4.3.0
intersect('^4.0.0', '~4.3.0');

// ~4.3.89
intersect('^4.0.0', '~4.3.89', '~4.3.24', '~4.3.63');

// throws "Range >=4.5.0 is not compatible with <4.4.0"
intersect('^4.0.0', '~4.3.0', '^4.5.0')
```
