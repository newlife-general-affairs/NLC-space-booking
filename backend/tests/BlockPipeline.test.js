const BlockPipeline = require('../blocks/BlockPipeline');
const BaseBlock = require('../blocks/BaseBlock');

class MockBlock extends BaseBlock {
  constructor(fn) {
    super();
    this.fn = fn;
  }
  async execute(context) {
    if (this.fn) {
      await this.fn(context);
    }
  }
}

describe('BlockPipeline', () => {
  it('should run blocks sequentially and pass context', async () => {
    const pipeline = new BlockPipeline();
    const trace = [];

    pipeline.use(new MockBlock((ctx) => {
      trace.push(1);
      ctx.step1 = true;
    }));

    pipeline.use(new MockBlock((ctx) => {
      trace.push(2);
      ctx.step2 = ctx.step1 ? 'yes' : 'no';
    }));

    const context = {};
    const result = await pipeline.run(context);

    expect(trace).toEqual([1, 2]);
    expect(result.step1).toBe(true);
    expect(result.step2).toBe('yes');
  });

  it('should throw an error if a block does not implement execute', () => {
    const pipeline = new BlockPipeline();
    expect(() => pipeline.use({})).toThrow('All pipeline blocks must implement the execute(context) method');
  });

  it('should propagate errors from blocks', async () => {
    const pipeline = new BlockPipeline();
    pipeline.use(new MockBlock(() => {
      throw new Error('Block failed');
    }));

    await expect(pipeline.run({})).rejects.toThrow('Block failed');
  });

  it('should stop executing subsequent blocks if context.stop is set to true', async () => {
    const pipeline = new BlockPipeline();
    const trace = [];

    pipeline.use(new MockBlock((ctx) => {
      trace.push(1);
      ctx.stop = true;
    }));

    pipeline.use(new MockBlock(() => {
      trace.push(2);
    }));

    await pipeline.run({});
    expect(trace).toEqual([1]);
  });
});
