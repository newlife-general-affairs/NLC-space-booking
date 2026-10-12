/**
 * BaseBlock
 * 
 * Abstract base class for the Lego Block pattern.
 * All individual blocks must extend this class and implement the execute method.
 */
class BaseBlock {
  /**
   * Execute the block logic.
   * @param {Object} context - The shared execution context.
   * @returns {Promise<void>}
   */
  async execute(context) {
    throw new Error(`execute method not implemented in ${this.constructor.name}`);
  }
}

module.exports = BaseBlock;
