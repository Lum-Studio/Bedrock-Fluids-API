import { Direction,ItemStack, BlockPermutation, system, world } from "@minecraft/server";

const air = BlockPermutation.resolve("air");
const distance = 35;
var currentTickRunned = false;
let revers = ["south","north","east","west"];

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
  if (nBlock.hasTag("fluid") && nBlock.permutation.getState("csm:depth") == maxSize-1 && itemStack.typeId == "minecraft:bucket") {
    nBlock.setPermutation(air);
    player.getComponent("equippable").setEquipment("Mainhand",new ItemStack("csm:oil_bucket"))
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
      player.runCommand("fog @s push csm:custom_fluid_fog fluid_fog");
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
function clearPerm(perm){
  for (let dir of ["south","north","east","west","down","up"]){
    perm= perm.withState("inv:"+dir,0)
  };
  return perm
}
function allNear(b,depth,tag){
  let dirs =["north","south","west","east"];
  for (let dir of dirs){
    let block = b[dir]();
    if (isEmpty(block)){
      block.setPermutation(clearPerm(b.permutation).withState("csm:depth",depth).withState("inv:"+revers[dirs.indexOf(dir)],2));
      b.setPermutation(b.permutation.withState("inv:"+dir,1))
    }
    if (block.hasTag(tag) && block.permutation.getState("csm:depth") < depth){
      block.setPermutation(block.permutation.withState("csm:depth",depth).withState("inv:"+revers[dirs.indexOf(dir)],2));
      b.setPermutation(b.permutation.withState("inv:"+dir,1))
    }
  }
}

function isEmpty(b){
  return b.isAir
}
function fluidTick(b,tag) {
  let maxSize = b.hasTag("7-length") ? 8 : 7;
  let perm = b.permutation;
  let depth = perm.getState("csm:depth");
  let isSource = depth == maxSize-1 || depth == maxSize+1;
  //check dying
  if (!isSource){
    let st = ["north","south","west","east"];
    let live;
    if (depth===maxSize) {
      live = b.above()?.hasTag(tag);
      b.setPermutation(b.permutation.withState("inv:up",1));

    } else 
    {
      live = st.some((dir)=>{
        let block = b[dir]();
        if (!block?.hasTag(tag)) return false;
        let depth2 = block.permutation.getState("csm:depth");
        if (depth2 < depth) b.permutation.withState("inv:"+dir,1)
        return depth2 > depth
      })
    }
    if (!live && b.below()?.hasTag(tag)) b.below()?.setPermutation(b.below().permutation.withState("inv:up",1))
    if (!live) b.setPermutation(air);
    
    // choosing variant and spreading
    let bel = b.below();
    if (depth===maxSize) {
      if (!isEmpty(bel) && !bel.hasTag(tag)) allNear(b,maxSize-2,tag);
      if (isEmpty(bel)) bel.setPermutation(perm.withState("csm:depth",maxSize))
    } else if (depth !== 1)
    {
      if (!isEmpty(bel) && !bel.hasTag(tag)) allNear(b,depth-1,tag);
      if (isEmpty(bel)) bel.setPermutation(perm.withState("csm:depth",maxSize));
      
      if (b.above()?.hasTag(tag)) b.setPermutation(perm.withState("csm:depth",maxSize));
    } else if (isEmpty(bel)) bel.setPermutation(perm.withState("csm:depth",maxSize));
  }else
  {
    b.setPermutation(perm.withState("csm:depth",b.above()?.hasTag(tag) ? maxSize+1 : maxSize-1 ));
    allNear(b,maxSize-2,tag);
    if (isEmpty(b.below())) b.below().setPermutation(perm.withState("csm:depth",maxSize))
  }
}

system.afterEvents.scriptEventReceive.subscribe((event)=>{
  let {sourceBlock:b,message,id} = event;
  if (id !== "csm:fluid" ) return;
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
  fluidTick(b,message)
})

