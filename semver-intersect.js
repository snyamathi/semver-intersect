const semver = require('semver');
const regex = {
    condition: /^([<=>]+)?/,
    majorVersion: /\d+/,
    minMax: /^>=([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?) <([\d]+\.[\d]+\.[\d]+)$/,
    version: /([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)$/,
    whitespace: /\s+/
};

function createShorthand (range) {
    const match = regex.minMax.exec(range);
    if (!match) {
        return range;
    }

    const [ min, max ] = match.slice(1);
    if (semver.major(min) !== semver.major(max)) {
        return `^${min}`;
    }

    return `~${min}`;
}

function ensureCompatible(range, ...bounds) {
    const { version } = parseRange(range);
    bounds.forEach(bound => {
        if (bound && !semver.satisfies(version, bound)) {
            throw new Error(`Range ${range} is not compatible with ${bound}`);
        }
    });
}

function expandRanges (...ranges) {
    return ranges.reduce((result, range) => {
        const validRange = semver.validRange(range);
        const validRanges = validRange.split(regex.whitespace);
        return union(result, validRanges);
    }, []);
}

function formatIntersection ({ lowerBound = '', upperBound = '' }) {
    if (lowerBound === upperBound) {
        return lowerBound;
    }

    return `${lowerBound} ${upperBound}`.trim();
}

function intersect (...ranges) {
    ranges = expandRanges(...ranges);

    const bounds = ranges.reduce(({ lowerBound, upperBound }, range) => {
        const { condition } = parseRange(range);

        // Exact version number specified, must be compatible with both bounds
        if (condition === '=') {
            ensureCompatible(range, lowerBound, upperBound);
            lowerBound = upperBound = range;
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

    const { condition, version } = parseRange(range);
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
        if (!result.includes(value)) {
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
