// reads parameters
// {"numDimensions":2,"players":[{"index":1,"type":"KorfBot"},{"index":2,"type":"Human"},{"index":3,"type":"KorfBot"},{"index":4,"type":"Human"}]}
// 2dgame/twogame.html?config=eyJudW1EaW1lbnNpb25zIjoyLCJwbGF5ZXJzIjpbeyJpbmRleCI6MSwidHlwZSI6Ikh1bWFuIn0seyJpbmRleCI6MiwidHlwZSI6Ikh1bWFuIn1dfQ%3D%3D

(function () {
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    let _NUM_DIMENSIONS;
    let _PLAYERS;

    if (!configParam) {
        console.warn('handle2d: no `config` query parameter');
        return;
    }
    try {
        const config = decodeBASE64_URLtoOBJ(configParam);
        console.log('Retrieved set up!')
        console.log(config);

        // SET GLOBAL VARS
        _NUM_DIMENSIONS = 2;
        _PLAYERS = config["players"];
    }
    catch (err) {
        console.error('handle2d: failed to decode config, go back', err);
        // EVENTUALLY ADD VISUAL ERROR HANDLING
    }
    console.log(_PLAYERS);

    // NEXT STEP: BUILD THE BOARD WITH EM SCRIPTEM
    
    

})();
