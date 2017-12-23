'use strict';
const semver = require('semver');
const regex = {
    condition: /^([<=>]+)?/,
    majorVersion: /\d+/,
    minMax: /^>=([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?) <=?([\d]+\.[\d]+\.[\d]+)$/,
    version: /([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)$/,
    whitespace: /\s+/
};
const slice = Array.prototype.slice;

function createShorthand (range) {
    const match = regex.minMax.exec(range);
    if (!match) {
        return range;
    }

    const parts = match.slice(1);
    const min = parts[0];
    const max = parts[1];
    if (min === max) {
        // Exact range
        return min;
    }

    // Special handling for major version 0
    if (semver.major(min) === 0 && semver.major(max) === 0) {
        // ^0.0.5
        if (semver.minor(min) === 0 && semver.minor(max) === 0) {
            return `^${min}`;
        }

        // ~0.0.5
        if (semver.minor(min) === 0) {
            return `~${min}`;
        }

        // ^0.5.0
        return `^${min}`;
    }

    if (semver.major(min) !== semver.major(max)) {
        if (semver.major(min) === 0) {
            return '0';
        }

        return `^${min}`;
    }

    return `~${min}`;
}

function ensureCompatible(range) {
    const parsed = parseRange(range);
    const version = parsed.version;
    const bounds = slice.call(arguments, 1);
    bounds.forEach(bound => {
        if (bound && !semver.satisfies(version, bound)) {
            throw new Error(`Range ${range} is not compatible with ${bound}`);
        }
    });
}

function expandRanges () {
    const ranges = slice.call(arguments)
    return ranges.reduce((result, range) => {
        const validRange = semver.validRange(range);
        const validRanges = validRange.split(regex.whitespace);
        return union(result, validRanges);
    }, []);
}

function formatIntersection (opts) {
    opts = opts || {};
    const lowerBound = opts.lowerBound || '';
    const upperBound = opts.upperBound || '';

    if (lowerBound === upperBound) {
        return lowerBound;
    }

    return `${lowerBound} ${upperBound}`.trim();
}

function intersect () {
    let ranges = slice.call(arguments);
    ranges = expandRanges.apply(null, ranges);

    const bounds = ranges.reduce((opts, range) => {
        opts = opts || {}
        let lowerBound = opts.lowerBound;
        let upperBound = opts.upperBound;
        const parsed = parseRange(range);
        const condition = parsed.condition

        // Exact version number specified, must be compatible with both bounds
        if (condition === '=') {
            ensureCompatible(range, lowerBound, upperBound);
            lowerBound = '>=' + range;
            upperBound = '<=' + range;
        }

        // New lower bound must be less than existing upper bound
        if (condition.startsWith('>')) {
            ensureCompatible(range, upperBound);
            lowerBound = mergeBounds(range, lowerBound);
        }

        // And vice versa
        if (condition.startsWith('<')) {
            ensureCompatible(range, lowerBound);
            upperBound = mergeBounds(range, upperBound);
        }

        return { lowerBound, upperBound };
    }, {});

    const range = formatIntersection(bounds);
    const shorthand = createShorthand(range);

    return shorthand;
}

function mergeBounds (range, bound) {
    if (!bound) {
        return range;
    }

    const parsed = parseRange(range);
    const condition = parsed.condition;
    const version = parsed.version;
    const boundingVersion = parseRange(bound).version;
    const comparator = condition.startsWith('<') ? semver.lt : semver.gt;
    const strict = condition === '<' || condition === '>';

    if (comparator(version, boundingVersion)) {
        return range;
    } else if (strict && semver.eq(version, boundingVersion)) {
        return range;
    } else {
        return bound;
    }
}

function parseRange (range) {
    const condition = regex.condition.exec(range)[1] || '=';
    const version = regex.version.exec(range)[1];
    return { condition, version };
}

function union (a, b) {
    return b.reduce((result, value) => {
        if (result.indexOf(value) === -1) {
            result.push(value);
        }
        return result;
    }, a);
}

module.exports.default = intersect;

module.exports.createShorthand = createShorthand;
module.exports.ensureCompatible = ensureCompatible;
module.exports.expandRanges = expandRanges;
module.exports.formatIntersection = formatIntersection;
module.exports.intersect = intersect;
module.exports.mergeBounds = mergeBounds;
module.exports.parseRange = parseRange;
module.exports.union = union;
