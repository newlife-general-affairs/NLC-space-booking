/**
 * BlockPipeline
 * 
 * Orchestrator that registers and executes blocks sequentially.
 * Passes a shared context through all blocks, allowing modular, linear pipelines.
 */
class BlockPipeline {
  constructor() {
    this.blocks = [];
  }

  /**
   * Registers a block to be executed in the pipeline sequence.
   * @param {Object} block - An instance of a block implementing BaseBlock interface.
   * @returns {BlockPipeline} The current pipeline instance for chaining.
   */
  use(block) {
    if (!block || typeof block.execute !== 'function') {
      throw new Error('All pipeline blocks must implement the execute(context) method');
    }
    this.blocks.push(block);
    return this;
  }

  /**
   * Runs the registered blocks sequentially.
   * @param {Object} context - The shared state passed across blocks.
   * @returns {Promise<Object>} The final execution context.
   */
  async run(context = {}) {
    for (const block of this.blocks) {
      try {
        await block.execute(context);
        if (context.stop) {
          break;
        }
      } catch (error) {
        console.error(`[BlockPipeline] Error during block execution: ${block.constructor.name}`, error);
        throw error;
      }
    }
    return context;
  }
}

module.exports = BlockPipeline;
