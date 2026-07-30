# Tasks

6. Make the tool keep track of your weights in each accessory lift as well, so that I have a suggest weight to do there as well!
7. (Deferred until it hurts) Replace the whole-app JSON.stringify equality checks in the save/sync paths with updatedAt-based dirty tracking. They re-serialize all of AppData on every change; cost grows with history size. Deliberately halted — revisit when saves feel slow.
