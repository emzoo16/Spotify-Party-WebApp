import { createStore, compose, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
/**
 * This is a reducer, a pure function with (state, action) => state signature.
 * It describes how an action transforms the state into the next state.
 *
 * The shape of the state is up to you: it can be a primitive, an array, an object,
 * or even an Immutable.js data structure. The only important part is that you should
 * not mutate the state object, but return a new object if the state changes.
 *
 * In this example, we use a `switch` statement and strings, but you can use a helper that
 * follows a different convention (such as function maps) if it makes sense for your
 * project.
 */

const initState = {
        activeMusicUri: undefined,
        activeMusicState: 'STOP',    // 'STOP', 'PAUSE' or 'PLAYING'
        roomId : 0,
        userName : '',      // host's name
        musicInfo : [],
        iniAtLanding: false     // prevent multiple request when redirected to host/guest page through landing page
    };


function appReducer(prevState = initState, action) {
    if (typeof prevState === 'undefined') {
        return Object.assign({}, initState);
    }

    let newS = JSON.parse(JSON.stringify(prevState))

    switch (action.type) {
        case 'UPDATE_ROOM_INFO':
            // expected input: a object that has matching attributes of the store
            // local playlist is not updated here
            return Object.assign(newS, action.data)

        case 'UPDATE_PLAYLIST':
            let musicInfo = sort(Array.from(action.data));

            Object.assign(newS, {
                musicInfo: musicInfo,
                activeMusicUri: musicInfo.length > 0 ? musicInfo[0].uri : undefined,
                // activeMusicState: 'PAUSE'
            })
            // sessionStorage.setItem('musicInfo',JSON.stringify(musicInfo));
            return newS
        case 'UPDATE_ACTIVE_MUSIC':

            Object.assign(newS, {
                activeMusicUri: action.data,
                activeMusicState: 'PLAYING'
            })
            return newS;

        case 'UPDATE_ACTIVE_MUSIC_STATE':
            Object.assign(newS, {activeMusicState: action.data})
            return newS;;

        case 'RESTORE_DEFAULT':
            return Object.assign({}, initState);

        default:
            return Object.assign({}, prevState);
    }
}

// Create a Redux store holding the state of your app.
// Its API is { subscribe, dispatch, getState }.

// It looks like you are passing several store enhancers to createStore().
// This is not supported. Instead, compose them together to a single function
const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

let store = createStore(
    appReducer,
    composeEnhancer(applyMiddleware(thunk))
)

function sort(arr){
    if (arr.length <= 1) return arr;
    let tracksToSort = arr.slice(1,arr.length)
    let sortedArray = tracksToSort.sort(function(trackA, trackB){
        let order = trackB.votes - trackA.votes
        if(order != 0){
            return order
        }else{
            if (trackA.name < trackB.name){
                return -1
            }else {
                return 1
            }
        }
    })
    sortedArray.unshift(arr[0])
    return sortedArray
}

// You can use subscribe() to update the UI in response to state changes.
// Normally you'd use a view binding library (e.g. React Redux) rather than subscribe() directly.
// However it can also be handy to persist the current state in the localStorage.

// store.subscribe(() => console.log(store.getState()))

// The only way to mutate the internal state is to dispatch an action.
// The actions can be serialized, logged or stored and later replayed.


export default store;
