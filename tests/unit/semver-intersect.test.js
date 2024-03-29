const {
    createShorthand,
    ensureCompatible,
    expandRanges,
    formatIntersection,
    intersect,
    mergeBounds,
    parseRange,
    distinct
} = require('../../semver-intersect');

describe('createShorthand', () => {
    it('should return exact ranges', () => {
        const result = createShorthand('4.0.0');
        expect(result).toEqual('4.0.0');
    });
    it('should simplify to a caret range', () => {
        const result = createShorthand('>=4.0.0 <5.0.0');
        expect(result).toEqual('^4.0.0');
    });
    it('should simplify to a tilde range', () => {
        const result = createShorthand('>=4.0.0 <4.1.0');
        expect(result).toEqual('~4.0.0');
    });
    it('should simplify with a pre-release tag', () => {
        const result = createShorthand('>=4.0.0-alpha <5.0.0');
        expect(result).toEqual('^4.0.0-alpha');
    });
    it('should simplify with a pre-release tag and identifier', () => {
        const result = createShorthand('>=4.0.0-beta.1 <4.1.0');
        expect(result).toEqual('~4.0.0-beta.1');
    });
    it('should simplify 0.14.x to ^0.14.0', () => {
        const result = createShorthand('>=0.14.0 <0.15.0');
        expect(result).toEqual('^0.14.0');
    });
    it('should simplify ^0.0.5', () => {
        const result = createShorthand('>=0.0.5 <0.0.6');
        expect(result).toEqual('^0.0.5');
    });
    it('should simplify ~0.0.5', () => {
        const result = createShorthand('>=0.0.5 <0.1.0');
        expect(result).toEqual('~0.0.5');
    });
    it('should simplify 0.x', () => {
        const result = createShorthand('>=0.0.0 <1.0.0');
        expect(result).toEqual('0');
    });
    it('should simplify ~0.0.x', () => {
        const result = createShorthand('>=0.0.0 <0.1.0');
        expect(result).toEqual('~0.0.0');
    });
    it('should simplify to ~0.0.0', () => {
        const result = createShorthand('>=0.0.0 <0.1.0');
        expect(result).toEqual('~0.0.0');
    });
    it('should simplify to ^0.0.0', () => {
        const result = createShorthand('>=0.0.0 <0.0.1');
        expect(result).toEqual('^0.0.0');
    });
    it('should simplify a range within the same major version', () => {
        const result = createShorthand('>=1.0.0 <=1.5.3');
        expect(result).toEqual('1.0.0 - 1.5.3');
    });
    it('should return granular ranges without changes', () => {
        [
            '>4.0.0',
            '<4.0.0',
            '<=4.0.0',
            '>=4.0.0',
            '4.0.0 - 4.0.5',
            '>4.0.0 <4.9.1'
        ].forEach(range => {
            const result = createShorthand(range);
            expect(result).toEqual(range);
        });
    });
});

describe('ensureCompatible', () => {
    it('should throw if an lower bound is higher than the existing higher bound', () => {
        const call = ensureCompatible.bind(null, '>=3.0.0', '<2.0.0');
        expect(call).toThrow('Range >=3.0.0 is not compatible with <2.0.0');
    });
    it('should throw if an upper bound is lower than the existing lower bound', () => {
        const call = ensureCompatible.bind(null, '<1.0.0', '>=2.0.0');
        expect(call).toThrow('Range <1.0.0 is not compatible with >=2.0.0');
    });
    it('should throw if an exact range is above an existing upper bound', () => {
        const call = ensureCompatible.bind(null, '3.0.0', '<2.0.0');
        expect(call).toThrow('Range 3.0.0 is not compatible with <2.0.0');
    });
    it('should throw if an exact range is below an existing lower bound', () => {
        const call = ensureCompatible.bind(null, '2.0.0', '>=3.0.0');
        expect(call).toThrow('Range 2.0.0 is not compatible with >=3.0.0');
    });
    it('should not throw if the new range is compatible with existing bounds', () => {
        expect(ensureCompatible.bind(null, '2.0.0', '>=1.0.0')).not.toThrow();
        expect(ensureCompatible.bind(null, '2.0.0')).not.toThrow();
        expect(ensureCompatible.bind(null, '>=2.0.0', '<5.0.0')).not.toThrow();
        expect(ensureCompatible.bind(null, '<4.0.0', '>2.0.0')).not.toThrow();
    });
});

describe('expandRanges', () => {
    it('should expand the list of ranges into a proper group of ranges', () => {
        const result = expandRanges('>=3.0.0 <4.0.0', '>=3.1.0 <4.0.0', '>=3.3.0');
        expect(result).toEqual([[['>=3.0.0', '<4.0.0']], [['>=3.1.0', '<4.0.0']], [['>=3.3.0']]]);
    });
    it('should expand a range between two versions', () => {
        const result = expandRanges('1.0.0 - 1.5.3');
        expect(result).toEqual([[['>=1.0.0', '<=1.5.3']]]);
    });
    it('should expand unions and X-ranges', () => {
        const result = expandRanges('1.* || 3.2.*', '*');
        expect(result).toEqual([[['>=1.0.0', '<2.0.0'], ['>=3.2.0', '<3.3.0']], [['>=0.0.0']]]);
    });
    it('should expand unions of simultaneously upper- and lower-bounded ranges', () => {
        const result = expandRanges('>=2.* <3.5.5 || ~3.6.0');
        expect(result).toEqual([[['>=2.0.0', '<3.5.5'], ['>=3.6.0', '<3.7.0']]]);
    })

});

describe('formatIntersection', () => {
    it('should return the exact condition if both bounds are the same', () => {
        const lowerBound = '3.0.0';
        const upperBound = '3.0.0';
        expect(formatIntersection({ lowerBound, upperBound })).toEqual('3.0.0');
    });
    it('should return the single condition if only one is provided', () => {
        const lowerBound = '>=3.0.0';
        const upperBound = '<4.0.0';
        expect(formatIntersection({ lowerBound })).toEqual('>=3.0.0');
        expect(formatIntersection({ upperBound })).toEqual('<4.0.0');
    });
    it('should the two bounds separated by a space', () => {
        const lowerBound = '>=3.0.0';
        const upperBound = '<4.0.0';
        expect(formatIntersection({ lowerBound, upperBound })).toEqual('>=3.0.0 <4.0.0');
    });
});

describe('intersect', () => {
    it('should return exact ranges', () => {
        const result = intersect('4.0.0');
        expect(result).toEqual('4.0.0');
    });
    it('should return a caret range', () => {
        const result = intersect('^4.0.0', '^4.3.0');
        expect(result).toEqual('^4.3.0');
    });
    it('should return a tilde range', () => {
        const result = intersect('^4.0.0', '~4.3.0');
        expect(result).toEqual('~4.3.0');
    });
    it('should intersect an x range and tilde range', () => {
      const result = intersect('4.x', '~4.3.0');
      expect(result).toEqual('~4.3.0');
    });
    it('should intersect an or range and tilde range', () => {
      const result = intersect('^4.1.2 || ^5.2.3', '~4.3.0');
      expect(result).toEqual('~4.3.0');
    });
    it('should intersect a wildcard range', () => {
      const result = intersect('1.*', '~1.3.0');
      expect(result).toEqual('~1.3.0');
    });
    it('should intersect two or ranges', () => {
      const result = intersect('^4.0.0 || ^5.1.2', '^4.1.2 || ^5.0.0');
      expect(result).toEqual('^4.1.2 || ^5.1.2');
    });
    it('should handle pre-release versions mixed with versions', () => {
        const result = intersect('^1.0.0-alpha.3', '^1.2.0');
        expect(result).toEqual('^1.2.0');
    });
    it('should handle compatible pre-release versions', () => {
        const result = intersect('^1.0.0-alpha.3', '^1.0.0-alpha.4');
        expect(result).toEqual('^1.0.0-alpha.4');
    });
    it('should handle compatible pre-release versions without a dot', () => {
        const result = intersect('^0.14.0-beta2', '^0.14.0-beta3');
        expect(result).toEqual('^0.14.0-beta3');
    });
    it('should handle compatible pre-release versions with the same preid', () => {
        const result = intersect('^0.14.0-beta', '^0.14.0-beta4');
        expect(result).toEqual('^0.14.0-beta4');
    });
    it('should handle incompatible pre-release versions (different patch version)', () => {
        const call = intersect.bind(null, '^1.9.0-alpha', '^1.9.1-alpha');
        expect(call).toThrow('Range >=1.9.1-alpha is not compatible with >=1.9.0-alpha');
    });
    it('should handle compatible pre-release versions (preid lower in alphabetical order)', () => {
        expect(intersect('^1.9.0-alpha', '^1.9.0-beta')).toEqual('^1.9.0-beta');
        expect(intersect('^1.9.0-beta', '^1.9.0-alpha')).toEqual('^1.9.0-beta');
        expect(intersect('^1.9.0-alpha.1', '^1.9.0-beta.2')).toEqual('^1.9.0-beta.2');
    });
    it('should handle incompatible pre-release versions (specific version)', () => {
        expect(intersect.bind(null, '1.9.0-alpha.1', '^1.9.0-alpha.2'))
            .toThrow('Range >=1.9.0-alpha.2 is not compatible with <=1.9.0-alpha.1');
        expect(intersect.bind(null, '1.9.0-alpha.1', '1.9.0-alpha.0'))
            .toThrow('Range 1.9.0-alpha.0 is not compatible with >=1.9.0-alpha.1');
        expect(intersect.bind(null, '1.9.0-rc3', '^1.9.0-rc4'))
            .toThrow('Range >=1.9.0-rc4 is not compatible with <=1.9.0-rc3');
    });
    it('should return an exact version intersected with a range', () => {
        const result = intersect('1.5.16', '^1.0.0');
        expect(result).toEqual('1.5.16');
    });
    it('should simplify redundant ranges', () => {
        const result = intersect('^4.0.0', '~4.3.89', '~4.3.24', '~4.3.63');
        expect(result).toEqual('~4.3.89');
    });
    it('should throw on incompatible ranges', () => {
        const call = intersect.bind(null, '^4.0.0', '~4.3.0', '^4.4.0');
        expect(call).toThrow('Range >=4.4.0 is not compatible with <4.4.0');
    });
    it('should throw if or range cannot be satisfied', () => {
      const call = intersect.bind(null, '^1.0.0 || ^3.0.0', '^2.0.0');
      expect(call).toThrow('Range >=2.0.0 is not compatible with <2.0.0');
    });
    it('should simplify issue 12', () => {
        const result = intersect('1.0.0 - 1.5.3');
        expect(result).toEqual('1.0.0 - 1.5.3');
    });
    it('should not cross major bounds', () => {
        expect(intersect.bind(null, '^5.0.0', '^4.0.1'))
            .toThrow('Range <5.0.0 is not compatible with >=5.0.0');
        expect(intersect.bind(null, '^5.0.0', '^3.0.0'))
            .toThrow('Range <4.0.0 is not compatible with >=5.0.0');
        expect(intersect.bind(null, '~5.1.0', '~5.2.0'))
            .toThrow('Range >=5.2.0 is not compatible with <5.2.0');
        expect(intersect.bind(null, '^0.5.0', '^0.4.0'))
            .toThrow('Range <0.5.0 is not compatible with >=0.5.0');
    });
});

describe('mergeBounds', () => {
    it('should return the range if there are no existing bound', () => {
        expect(mergeBounds('>=5.0.0')).toEqual('>=5.0.0');
    });
    it('should merge a new lower bound with an existing lower bound', () => {
        expect(mergeBounds('>=5.0.0', '>=5.1.0')).toEqual('>=5.1.0');
        expect(mergeBounds('>=5.5.0', '>=5.1.0')).toEqual('>=5.5.0');
    });
    it('should merge a new upper bound with an existing upper bound', () => {
        expect(mergeBounds('<4.2.0', '<4.1.0')).toEqual('<4.1.0');
        expect(mergeBounds('<4.0.5', '<4.1.0')).toEqual('<4.0.5');
    });
    it('should replace a loose comparator with a strict comparator', () => {
        expect(mergeBounds('<4.1.0', '<=4.1.0')).toEqual('<4.1.0');
    });
});

describe('parseRange', () => {
    it('return the comparison condition and version', () => {
        expect(parseRange('<5.0.0')).toEqual({
            condition: '<',
            prerelease: null,
            version: '5.0.0'
        });
        expect(parseRange('>=4.0.0')).toEqual({
            condition: '>=',
            prerelease: null,
            version: '4.0.0'
        });
        expect(parseRange('3.0.0')).toEqual({
            condition: '=',
            prerelease: null,
            version: '3.0.0'
        });
    });
});

describe('distinct', () => {
    it('should return array without duplicates', () => {
        const result = distinct([1, 5, 2, 3, 4, 5, 3]);
        expect(result).toEqual([1, 5, 2, 3, 4]);
    });
});
