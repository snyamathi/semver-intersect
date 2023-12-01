const semver = require('semver');
const regex = {
    condition: /^([<=>]+)?/,
    majorVersion: /\d+/,
    minMax: /^>=([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?) <=?([\d]+\.[\d]+\.[\d]+)$/,
    version: /([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)$/,
    whitespace: /\s+/,
    or: /\|\|/,
    x: /^x|X|\*$/,
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

    // Stable range with an inclusive max version
    if (range.includes('<=')) {
        return `${min} - ${max}`;
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
    const { prerelease, version } = parseRange(range);

    bounds.forEach(bound => {
        if (!bound) {
            return;
        }

        if (semver.satisfies(version, bound) && semver.intersects(range, bound)) {
            return;
        }

        if (prerelease) {
            if (parseRange(bound).prerelease) {
                // If both bounds are pre-release versions, either can satisfy the other
                if (semver.satisfies(parseRange(bound).version, range)) {
                    return;
                }
            } else if (semver.satisfies(version, `${range} ${bound}`)) {
                // If only our version is a pre-release version, don't fail on 1.0.0-a <2.0.0
                return;
            }
        }

        throw new Error(`Range ${range} is not compatible with ${bound}`);
    });
}

/**
 * Transform every provided semver range string by creating arrays from logical-or operation members
 * and expanding all x-ranges
 * @example
 * expandRanges('1.* || 3.*', '* || 2.2.*')
 * should return [[['>=1.0.0', '<2.0.0'], ['>=3.0.0', '<4.0.0']], [['>=0.0.0'], ['>=2.2.0', '<2.3.0']]]
 */
function expandRanges (...ranges) {
    return ranges.map((range) => {
        const validRange = semver.validRange(range);
        return validRange.split(regex.or)
            .map((part) => {
                const simpleRanges = part.split(regex.whitespace)
                    .map(coerceRange)
                return distinct(simpleRanges)
            });
    });
}

function formatIntersection ({ lowerBound = '', upperBound = '' }) {
    if (lowerBound === upperBound) {
        return lowerBound;
    }

    return `${lowerBound} ${upperBound}`.trim();
}

function updateBounds({ lowerBound, upperBound }, range) {
    const { condition, prerelease } = parseRange(range);

    if (prerelease) {
        ensureCompatible(range, lowerBound, upperBound);
    }

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
}

function intersect (...ranges) {
    const rangeUnions = expandRanges(...ranges);

    const resultUnion = rangeUnions.reduce((boundsUnion, rangeUnion) => {
        let error

        const intermediateBounds = allPairs(boundsUnion, rangeUnion)
            .map(([bound, ranges]) => {
                try {
                    return ranges.reduce(updateBounds, bound)
                } catch (e) {
                    error ??= e
                    return null
                }
            })
            .filter(Boolean)

        if (!intermediateBounds.length) {
            throw error
        }

        return intermediateBounds
    }, [{}]);

    return resultUnion.map((bound) => {
        const range = formatIntersection(bound);
        return createShorthand(range);
    }).join(' || ');
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

function coerceRange(range) {
    return regex.x.exec(range) ? '>=0.0.0' : range
}

function parseRange (range) {
    const condition = regex.condition.exec(range)[1] || '=';
    const version = regex.version.exec(range)[1];
    const prerelease = semver.prerelease(version);
    return { condition, prerelease, version };
}

function distinct(a) {
    return [...new Set(a)];
}

function allPairs(arr1, arr2) {
    return arr1.reduce((acc, cur) => {
        arr2.forEach((y) => acc.push([cur, y]))
        return acc
    }, [])
}

module.exports.default = intersect;

module.exports.createShorthand = createShorthand;
module.exports.ensureCompatible = ensureCompatible;
module.exports.expandRanges = expandRanges;
module.exports.formatIntersection = formatIntersection;
module.exports.intersect = intersect;
module.exports.mergeBounds = mergeBounds;
module.exports.parseRange = parseRange;
module.exports.distinct = distinct;
