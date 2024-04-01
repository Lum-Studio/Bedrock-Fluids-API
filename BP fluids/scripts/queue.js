import {system} from "@minecraft/server";

export class fluidQueue{
    type;
    #marked = []; // Positions
    #optimized=[];
    #instant=[];
    #isRunning = false;
    #runId;
    blockOperation;

    constructor(operation){
        if (!(operation instanceof Function)){
            throw new Error("Operation should be a function with one parameter")
        };
        this.blockOperation = operation;
    }

    add(block){
        if (!isRunning) return console.warn("§cThe fluid queue is stopped, you can't use any methods")
        if (block.typeId === this.type){
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
     */
    skipQueueFor(position){
        if (!this.#marked.any((v)=>block.x === v.x && block.y === v.y && block.z === v.z)){
            this.#marked.push(position)
        }
    }

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
    
    stop(){
        if (this.#isRunning){
            system.clearRun(this.#runId);
            this.#isRunning = false
        }
    }
}
