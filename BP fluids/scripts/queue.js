import {system} from "@minecraft/server";

export class fluidQueue{
    type;
    #marked = []; // Positions
    #optimized=[];
    #instant=[];
    #isRunning = false;
    #runId;
    blockOperation;
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
    constructor(operation,blockTypeId){
        if (!(operation instanceof Function) || operation.length !== 1){
            throw new Error("Operation should be a function with one parameter")
        };
        this.type=blockTypeId;
        this.blockOperation = operation;
    }
    /**
     * Adds the fluid block to the queue
     * @param {Block} block 
     */
    add(block){
        if (!isRunning) console.warn("§cThe fluid queue is stopped, you can't use any methods")
        else if (block.typeId === this.type){
            if (this.#marked.any((v)=>block.x === v.x && block.y === v.y && block.z === v.z)){
                this.#instant.push(block);
                // delete mark
                this.#marked.splice(this.#marked.findIndex((v)=>block.x === v.x && block.y === v.y && block.z === v.z),1);
                const index = this.#optimized.findIndex((v)=>block.x === v.x && block.y === v.y && block.z === v.z);
                if (index!== -1) this.#optimized.splice(index,1)
            } else {
                this.#optimized.push(block);
            }
        }
    }
    /**
     * Makes the block ignore queue the next time
     * @param {Vector3} position
     */
    skipQueueFor(position){
        if (!this.#marked.any((v)=>block.x === v.x && block.y === v.y && block.z === v.z)){
            this.#marked.push(position)
        }
    }
    /**
     * Starts the fluid flow, spreading and changing
     * @param {number} countPerTick 
     */
    run(countPerTick){
        this.stop();
        this.#runId = system.runInterval(()=>{
            for (let block of this.#instant){
                try {
                    this.blockOperation(block)
                } catch (error){
                    console.error("FluidQueue of {"+this.type+"}: Instant: "+error)
                }
            };
            this.#instant.length = 0;
            for (let iteration = 0; iteration < countPerTick; iteration++){

                if (this.#optimized.length === 0) break;

                let block = this.#optimized.shift();
                if (!block?.typeId || block.typeId !== this.type) continue;

                try {
                    this.blockOperation(block)
                } catch (error){
                    console.error("FluidQueue of {"+this.type+"}: Ticking: Iteration #"+iteration+": "+error)
                }
            }
        },0);
        this.#isRunning = true
    }
    /**
     * Stops the fluid flow, spreading and changing
     */
    stop(){
        if (this.#isRunning){
            system.clearRun(this.#runId);
            this.#isRunning = false
        }
    }
}
