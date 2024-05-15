import os
import json
from itertools import combinations

file_path = "crude_oil.json"
fluid_tag = "custom_fluid"
depth = [1,2,3,4,5,6,7,8]
geometries = [1,2,3,4,6,7,8,8]
texture_still = "oil"
texture_diagonal = "oil" # TODO: add an animated texture for diagonal flowing oil
flowing = "flowing_oil"
directions = ["none","s","n","e","w","ns","ne","se","sw"]
invisible = [ "north","east","south","west","down","up" ]
from itertools import combinations


def delete_repeating_elements(arr):
    unique_elements = []
    for elem in arr:
        if elem not in unique_elements:
            unique_elements.append(elem)
    return unique_elements



        
        
            
            
def getBones(invisibl,direction):
    if directions.count(invisibl) == 0:
        return invisibl
    d = directions.index(direction)
    inv = directions.index(invisibl)
    return directions[(d+inv)%4]
            
array =[]
for x in range(len(depth)):
    for num in range(len(directions)):
        dire = directions[num]

        cond1 = f"q.block_state('lumstudio:depth') == {str(depth[x])} && q.block_state('lumstudio:direction') == '{dire}'"
        rot =  None
        mat = {"*":{"texture":flowing,"render_method": "blend","face_dimming": False,"ambient_occlusion": False}}
        if (dire == "none"):
            mat["up"] = {"texture":texture_still,"render_method": "blend","face_dimming": False,"ambient_occlusion": False}
        match dire:
            case "w":
                rot = [0,-90,0]
            case "e":
                rot = [0,90,0]
            case "n":
                rot = [0,180,0]
            case "nw":
                rot = [0,-90,0]
            case "se":
                rot = [0,90,0]
            case "ne":
                rot = [0,180,0]
        if len(dire) == 2:
            mat["up"]["texture"] = texture_diagonal
        geom = {"identifier":"geometry.fluid."+str(geometries[x])}
        
        for i in [0]:
            for r in [0]:
                lst2 =list(combinations(invisible,r))
                lst2.append([])
                if True:
                    
                    mat1=mat.copy()
                    bones = {
                        "up":"q.block_state('lumstudio:invisible_up') == 0",
                        "down":"q.block_state('lumstudio:invisible_down') == 0",
                        "north":"q.block_state('lumstudio:invisible_north') == 0",
                        "east":"q.block_state('lumstudio:invisible_east') == 0",
                        "west":"q.block_state('lumstudio:invisible_west') == 0",
                        "south":"q.block_state('lumstudio:invisible_south') == 0",
                        "north_half":"q.block_state('lumstudio:invisible_north') == 1",
                        "east_half":"q.block_state('lumstudio:invisible_east') == 1",
                        "west_half":"q.block_state('lumstudio:invisible_west') == 1",
                        "south_half":"q.block_state('lumstudio:invisible_south') == 1",
                    }
                    if (geometries[x] == 8):
                        bones.update({
                            "north_micro":"q.block_state('lumstudio:invisible_north') == 3",
                            "south_micro":"q.block_state('lumstudio:invisible_south') == 3",
                            "west_micro":"q.block_state('lumstudio:invisible_west') == 3",
                            "east_micro":"q.block_state('lumstudio:invisible_east') == 3"
                        }) 
                    gg = geom.copy()
                    if len(list(bones.keys())) > 0:
                        gg["bone_visibility"]=bones
                    res = {"condition":cond1,"components":{"minecraft:geometry":gg}}

                    if mat1 != None:
                        res["components"]["minecraft:material_instances"]=mat1
                    if rot != None:
                        res["components"]["minecraft:transformation"]={"rotation":rot}
                    array.append(res)
array = delete_repeating_elements(array)
with open(file_path, "w") as f1:
    f1.write('"permutations": '+json.dumps(array, indent=2))
print(len(array))
input()