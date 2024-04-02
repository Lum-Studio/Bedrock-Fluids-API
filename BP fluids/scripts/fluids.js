import { Direction,ItemStack, BlockPermutation, system, world } from "@minecraft/server";
import { FluidQueue } from "./queue";

const air = BlockPermutation.resolve("air");
const distance = 35;
var currentTickRunned = false;
let revers = ["south","north","east","west"];
// placing & taking
world.afterEvents.itemUse.subscribe(({block,itemStack,source:player})=>{
  
  let tag = itemStack.getTags().find((str)=>str.startsWith("placer:"));
  let hit = player.getBlockFromViewDirection({includePassableBlocks:true,maxDistance:6});
  if (!hit) return;
  let {face,block:b} = hit;
  let dir;
  switch (face){
    case Direction.Up:
      dir="above";
      break;
    case Direction.Down:
      dir="below";
      break;
    default:
      dir = face.toLowerCase()
  };
  let nBlock = b[dir]();
  let maxSize = nBlock.hasTag("7-length") ? 8 : 7;
  if (nBlock.isAir && tag) {
    player.getComponent("equippable").setEquipment("Mainhand",new ItemStack("bucket"))
    nBlock.setPermutation(BlockPermutation.resolve(tag.slice(7)))
  };
  if (nBlock.hasTag("fluid") && nBlock.permutation.getState("lumstudio:depth") == maxSize-1 && itemStack.typeId == "minecraft:bucket") {
    nBlock.setPermutation(air);
    player.getComponent("equippable").setEquipment("Mainhand",new ItemStack("lumstudio:oil_bucket"))
  }

})
world.beforeEvents.itemUseOn.subscribe((ev)=>{
  
  let {source:player, blockFace,itemStack,block} = ev;
  let tag = itemStack.getTags().find((str)=>str.startsWith("placer:"));
  if (!tag) return;
  let dir;
  switch (blockFace){
    case Direction.Up:
      dir="above";
      break;
    case Direction.Down:
      dir="below";
      break;
    default:
      dir = blockFace.toLowerCase()
  };
  let replaced=block[dir]();
  if (replaced.hasTag("fluid")){
    system.run(()=>{
      let iS = player.getComponent("equippable").getEquipment("Mainhand");
      if (iS.typeId !== itemStack.typeId) return;
      
      replaced.setPermutation(BlockPermutation.resolve(tag.slice(7)))
      player.getComponent("equippable").setEquipment("Mainhand",new ItemStack("bucket"))
    })
  }
})
world.beforeEvents.itemUseOn.subscribe((ev)=>{
  if (currentTickRunned) return;
  let {source:player, blockFace,itemStack,block} = ev;
  try{
    let perm = BlockPermutation.resolve(itemStack.typeId);
    let dir;
    switch (blockFace){
      case Direction.Up:
        dir="above";
        break;
      case Direction.Down:
        dir="below";
        break;
      default:
        dir = blockFace.toLowerCase()
    };
    let replaced=block[dir]();
    if (replaced.dimension.getEntitiesAtBlockLocation(replaced.location).length > 0) return;
    if (!replaced.hasTag("fluid")) return;
    currentTickRunned=true;
    system.run(()=>{
      let iS = player.getComponent("equippable").getEquipment("Mainhand");
      if (!iS.isStackableWith(itemStack)) return;
      
      replaced.setPermutation(perm)
      if (!block.dimension.getBlock(replaced.location).permutation.matches(itemStack.typeId))  return;
      try{
        iS.amount-=1
        player.getComponent("equippable").setEquipment("Mainhand",iS);
      } catch{
        player.getComponent("equippable").setEquipment("Mainhand")
      }
    })
  }catch{}
})
// Floating
system.runInterval(() => {
  currentTickRunned=false;
  const players = world.getPlayers();

  for (const player of players) {
    // Fluid buoyancy
    if (player.isJumping && player.dimension.getBlock({ ...player.location, y: player.location.y + 0.7 }).hasTag('fluid')) {
      player.applyKnockback(0,0,0,Math.max(0.1,Math.min((player.getVelocity().y*0.7)+0.1,0.3)));
      system.run(()=>player.applyKnockback(0,0,0,Math.max(0.1,Math.min((player.getVelocity().y*0.7)+0.1,0.3))))
    } else
    if (
      (player.dimension.getBlock({ ...player.location, y: player.location.y + 1 }).hasTag('fluid') ||
      player.dimension.getBlock(player.location).hasTag('fluid')) &&
      player.getVelocity().y < 0.01
    ) {
      
      player.applyKnockback(0,0,0,player.getVelocity().y*0.2);
      
    }
    // Fluid fog
    if (player.dimension.getBlock(player.getHeadLocation()).hasTag('fluid')) {
      player.runCommand("fog @s push lumstudio:custom_fluid_fog fluid_fog");
    } else {
      player.runCommand("fog @s remove fluid_fog");
    }
  }
});
system.runInterval(() => {
  const players = world.getPlayers();
  for (const player of players) {
    if (player.isJumping && player.dimension.getBlock({ ...player.location, y: player.location.y + 0.7 }).hasTag('fluid')) {
      player.addEffect("slow_falling",1,{showParticles:false})
    }
  }
},2);

// Queues
const Queues = {
  "lumstudio:oil": new FluidQueue(fluidBasic,"lumstudio:oil")
}
for (let queue of Object.values(Queues)){
  queue.run(20)
}
// Main
function fluidBasic(b) {

}

system.afterEvents.scriptEventReceive.subscribe((event)=>{
  let {sourceBlock:b,message,id} = event;
  if (id !== "lumstudio:fluid") return;
  if (!b) return;
  if (
    world.getAllPlayers().every(
      (P)=> {
        let dist = Math.sqrt(
          Math.pow(b.location.x-P.location.x,2)
          + Math.pow(b.location.z-P.location.z,2)
          + Math.pow(b.location.y-P.location.y,2)
        );
        return distance < dist
      }
    )
  ) return;
  /**
   * @type FluidQueue
   */
  let Q = Queues[b.typeId];
  if (Q){
    Q.add(b)
  }
})

