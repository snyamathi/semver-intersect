const expect = require('chai').expect;
const {
    createShorthand,
    ensureCompatible,
    expandRanges,
    formatIntersection,
    intersect,
    mergeBounds,
    parseRange,
    union
} = require('../../semver-intersect');

describe('createShorthand', () => {
    it('should return exact ranges', () => {
        const result = createShorthand('4.0.0');
        expect(result).to.equal('4.0.0');
    });
    it('should simplify to a caret range', () => {
        const result = createShorthand('>=4.0.0 <5.0.0');
        expect(result).to.equal('^4.0.0');
    });
    it('should simplify to a tilde range', () => {
        const result = createShorthand('>=4.0.0 <4.1.0');
        expect(result).to.equal('~4.0.0');
    });
    it('should simplify with a pre-release tag', () => {
        const result = createShorthand('>=4.0.0-alpha <5.0.0');
        expect(result).to.equal('^4.0.0-alpha');
    });
    it('should simplify with a pre-release tag and identifier', () => {
        const result = createShorthand('>=4.0.0-beta.1 <4.1.0');
        expect(result).to.equal('~4.0.0-beta.1');
    });
    it('should simplify 0.14.x to ^0.14.0', () => {
        const result = createShorthand('>=0.14.0 <0.15.0');
        expect(result).to.equal('^0.14.0');
    });
    it('should simplify ^0.0.5', () => {
        const result = createShorthand('>=0.0.5 <0.0.6');
        expect(result).to.equal('^0.0.5');
    });
    it('should simplify ~0.0.5', () => {
        const result = createShorthand('>=0.0.5 <0.1.0');
        expect(result).to.equal('~0.0.5');
    });
    it('should simplify to ~0.0.0', () => {
        const result = createShorthand('>=0.0.0 <0.1.0');
        expect(result).to.equal('~0.0.0');
    });
    it('should simplify to ^0.0.0', () => {
        const result = createShorthand('>=0.0.0 <0.0.1');
        expect(result).to.equal('^0.0.0');
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
            expect(result).to.equal(range);
        });
    });
});

describe('ensureCompatible', () => {
    it('should throw if an lower bound is higher than the existing higher bound', () => {
        const call = ensureCompatible.bind(null, '>=3.0.0', '<2.0.0');
        expect(call).to.throw('Range >=3.0.0 is not compatible with <2.0.0');
    });
    it('should throw if an upper bound is lower than the existing lower bound', () => {
        const call = ensureCompatible.bind(null, '<1.0.0', '>=2.0.0');
        expect(call).to.throw('Range <1.0.0 is not compatible with >=2.0.0');
    });
    it('should throw if an exact range is above an existing upper bound', () => {
        const call = ensureCompatible.bind(null, '3.0.0', '<2.0.0');
        expect(call).to.throw('Range 3.0.0 is not compatible with <2.0.0');
    });
    it('should throw if an exact range is below an existing lower bound', () => {
        const call = ensureCompatible.bind(null, '2.0.0', '>=3.0.0');
        expect(call).to.throw('Range 2.0.0 is not compatible with >=3.0.0');
    });
    it('should not throw if the new range is compatible with existing bounds', () => {
        expect(ensureCompatible.bind(null, '2.0.0', '>=1.0.0')).to.not.throw();
        expect(ensureCompatible.bind(null, '2.0.0')).to.not.throw();
        expect(ensureCompatible.bind(null, '>=2.0.0', '<5.0.0')).to.not.throw();
        expect(ensureCompatible.bind(null, '<4.0.0', '>2.0.0')).to.not.throw();
    });
});

describe('expandRanges', () => {
    it('should expand the list of ranges into a set of unique individual ranges', () => {
        const result = expandRanges('>=3.0.0 <4.0.0', '>=3.1.0 <4.0.0', '>=3.3.0');
        expect(result).to.deep.equal(['>=3.0.0', '<4.0.0', '>=3.1.0', '>=3.3.0']);
    });
});

describe('formatIntersection', () => {
    it('should return the exact condition if both bounds are the same', () => {
        const lowerBound = '3.0.0';
        const upperBound = '3.0.0';
        expect(formatIntersection({ lowerBound, upperBound })).to.equal('3.0.0');
    });
    it('should return the single condition if only one is provided', () => {
        const lowerBound = '>=3.0.0';
        const upperBound = '<4.0.0';
        expect(formatIntersection({ lowerBound })).to.equal('>=3.0.0');
        expect(formatIntersection({ upperBound })).to.equal('<4.0.0');
    });
    it('should the two bounds separated by a space', () => {
        const lowerBound = '>=3.0.0';
        const upperBound = '<4.0.0';
        expect(formatIntersection({ lowerBound, upperBound })).to.equal('>=3.0.0 <4.0.0');
    });
});

describe('intersect', () => {
    it('should return exact ranges', () => {
        const result = intersect('4.0.0');
        expect(result).to.equal('4.0.0');
    });
    it('should return a caret range', () => {
        const result = intersect('^4.0.0', '^4.3.0');
        expect(result).to.equal('^4.3.0');
    });
    it('should return a tilde range', () => {
        const result = intersect('^4.0.0', '~4.3.0');
        expect(result).to.equal('~4.3.0');
    });
    it('should return an exact version intersected with a range', () => {
        const result = intersect('1.5.16', '^1.0.0');
        expect(result).to.equal('1.5.16');
    });
    it('should simplify redundant ranges', () => {
        const result = intersect('^4.0.0', '~4.3.89', '~4.3.24', '~4.3.63');
        expect(result).to.equal('~4.3.89');
    });
    it('should throw on incompatible ranges', () => {
        const call = intersect.bind(null, '^4.0.0', '~4.3.0', '^4.4.0');
        expect(call).to.throw('Range >=4.4.0 is not compatible with <4.4.0');
    });
});

describe('mergeBounds', () => {
    it('should return the range if there are no existing bound', () => {
        expect(mergeBounds('>=5.0.0')).to.equal('>=5.0.0');
    });
    it('should merge a new lower bound with an existing lower bound', () => {
        expect(mergeBounds('>=5.0.0', '>=5.1.0')).to.equal('>=5.1.0');
        expect(mergeBounds('>=5.5.0', '>=5.1.0')).to.equal('>=5.5.0');
    });
    it('should merge a new upper bound with an existing upper bound', () => {
        expect(mergeBounds('<4.2.0', '<4.1.0')).to.equal('<4.1.0');
        expect(mergeBounds('<4.0.5', '<4.1.0')).to.equal('<4.0.5');
    });
    it('should replace a loose comparator with a strict comparator', () => {
        expect(mergeBounds('<4.1.0', '<=4.1.0')).to.equal('<4.1.0');
    });
});

describe('parseRange', () => {
    it('return the comparison condition and version', () => {
        expect(parseRange('<5.0.0')).to.deep.equal({
            condition: '<',
            version: '5.0.0'
        });
        expect(parseRange('>=4.0.0')).to.deep.equal({
            condition: '>=',
            version: '4.0.0'
        });
        expect(parseRange('3.0.0')).to.deep.equal({
            condition: '=',
            version: '3.0.0'
        });
    });
});

describe('union', () => {
    it('should merge arrays without duplicates', () => {
        const result = union([1, 2, 3], [3, 4, 5]);
        expect(result).to.deep.equal([1, 2, 3, 4, 5]);
    });
});
