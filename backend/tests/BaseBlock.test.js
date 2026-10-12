const BaseBlock = require('../blocks/BaseBlock');

describe('BaseBlock', () => {
  it('should throw an error if execute is not implemented', async () => {
    const block = new BaseBlock();
    await expect(block.execute({})).rejects.toThrow('execute method not implemented');
  });
});
