const semver = require('semver');
const regex = {
    condition: /^([<=>]+)?/,
    majorVersion: /\d+/,
    minMax: /^>=([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?) <=?([\d]+\.[\d]+\.[\d]+)$/,
    prerelease: /([^\d]+)([\d]+)?/,
    version: /([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)$/,
    whitespace: /\s+/
};

function createShorthand (range) {
    const match = regex.minMax.exec(range);
    if (!match) {
        return range;
    }

    const [ min, max ] = match.slice(1);
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

function ensureCompatible(range, ...bounds) {
    const { major, minor, patch } = parseRange(range);
    const version = [major, minor, patch].join('.');

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

// Prerelease versions must have the exact same major, minor, patch, and prerelease id
function checkPrereleaseVersions (range, bound) {
    const parsedRange = parseRange(range);
    const parsedBound = parseRange(bound);

    if (parsedRange.prerelease && parsedBound.prerelease) {
        if (
            (parsedRange.major !== parsedBound.major) ||
            (parsedRange.minor !== parsedBound.minor) ||
            (parsedRange.patch !== parsedBound.patch) ||
            (parsedRange.prerelease[0] !== parsedBound.prerelease[0])
        ) {
            throw new Error(`Prerelease version ${range} is not compatible with ${bound}`);
        }
    }
}

function mergeBounds (range, bound) {
    if (!bound) {
        return range;
    }

    checkPrereleaseVersions(range, bound);
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
    const major = semver.major(version);
    const minor = semver.minor(version);
    const patch = semver.patch(version);

    let prerelease = semver.prerelease(version);
    if (prerelease && prerelease.length === 1) {
        // Normalize prerelease tags such as -rc4 with -rc.4
        prerelease = regex.prerelease.exec(prerelease[0]).slice(1);
    }

    return { condition, major, minor, patch, prerelease, version };
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
