import { system } from "@minecraft/server";

export class FluidQueue {
    #marked = new Set(); // Use Set for faster membership check
    #optimized = [];
    #instant = [];
    #isRunning = false;
    #runId;
    /**
     * Callback Function that changes the block
     * @callback callback
     * @param {Block} block
     */
    /**
     * Creates new Fluid Queue
     * @param {callback} operation
     * @param {string} blockTypeId
     */
    constructor(operation, blockTypeId) {
        if (typeof operation !== 'function' || operation.length !== 1) {
            throw new Error("Operation should be a function with one parameter");
        }
        this.type = blockTypeId;
        this.blockOperation = operation;
    }
    /**
     * Adds the fluid block to the queue
     * @param {Block} block
     */
    add(block) {
        if (!this.#isRunning) {
            console.warn("§cThe fluid queue is stopped, you can't use any methods");
        } else if (block.typeId === this.type) {
            if (this.#marked.has(block)) {
                this.#instant.push(block);
                this.#marked.delete(block);
                const index = this.#optimized.findIndex((v) => v === block);
                if (index !== -1) this.#optimized.splice(index, 1);
            } else {
                this.#optimized.push(block);
            }
        }
    }
    /**
     * Makes the block ignore queue the next time
     * @param {Block} block
     */
    skipQueueFor(block) {
        this.#marked.add(block);
    }
    /**
     * Starts the fluid flow, spreading and changing
     * @param {number} countPerTick Runs all registered fluids and their operation for x amount of times in a tick
     */
    run(countPerTick) {
        this.stop();
        this.#runId = system.runInterval(() => {
            for (const block of this.#instant) {
                try {
                    this.blockOperation(block);
                } catch (error) {
                    console.error(`FluidQueue of ${this.type}: Instant: ${error}`);
                }
            }
            this.#instant.length = 0;
            for (let iteration = 0; iteration < countPerTick; iteration++) {
                if (this.#optimized.length === 0) break;

                const block = this.#optimized.shift();
                if (!block?.typeId || block.typeId !== this.type) continue;

                try {
                    this.blockOperation(block);
                } catch (error) {
                    console.error(`FluidQueue of ${this.type}: Ticking: Iteration #${iteration}: ${error}`);
                }
            }
        }, 0);
        this.#isRunning = true;
    }
    /**
     * Stops the fluid flow, spreading and changing
     */
    stop() {
        if (this.#isRunning) {
            system.clearRun(this.#runId);
            this.#isRunning = false;
        }
    }
}
