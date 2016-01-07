const keys = Object.keys;
const assign = Object.assign;
const freeze = Object.freeze;


// General-purpose utilities.

const assignWith = (dst, src, func) => {
    const keyArray = keys(src);
    const keyLength = keyArray.length;
    for (let i = 0; i < keyLength; i++) {
        const key = keyArray[i];
        dst[key] = func(src[key], key);
    }
    return dst;
};


// Type detection utilities.

const isFunction = value => typeof value === "function";


// Stores.

/**
 * Creates a wrapped state object and returns two functions for
 * interacting with it.
 *
 * getState(): Returns a snapshot of the current state.
 * subscribe(listener): Will notify the listener on any change to the state,
 *     and immediately call the listener to notify of current state. Returns
 *     an unsubscribe function.
 * dispatch(action): Mutates the state using the given action. An action is a
 *     function of type (state, dispatch, getState) => state.
 */
export const createStore = () => {
    // Wrapped state.
    let state;
    const getState = () => state;
    // Subscriptions management.
    const listeners = [];
    const subscribe = listener => {
        listeners.push(listener);
        listener(state);
        // The unsubscribe function.
        return () => {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        };
    };
    // State management.
    let dispatchDepth = 0;
    const dispatch = action => {
        if (!isFunction(action)) {
            throw new Error(`Actions should be plain functions: ${action}`);
        }
        const initialState = state;
        // Run the action.
        dispatchDepth += 1;
        try {
            state = action(state, dispatch, getState);
        } finally {
            dispatchDepth -= 1;
        }
        // Only update the listeners if we've finished dispatching and the state has actually changed.
        if (state !== initialState && dispatchDepth === 0) {
            listeners.forEach(listener => listener(state));
        }
    };
    // All done!
    return {getState, subscribe, dispatch};
};


// Action creators.

const EMPTY_STATE = freeze({});

const createNestedDispatch = (dispatch, key) => action => {
    const props = {};
    props[key] = action;
    dispatch(setState(props));
};

/**
 * An action creator that will merge the existing
 * state with the new state.
 *
 * If any of the keys of the new state are actions,
 * they will be dispatched with the value of the nested state.
 */
export const setState = props => (state=EMPTY_STATE, dispatch, getState) => freeze(assignWith(assign({}, state), props, (value, key) => {
    if (isFunction(value)) {
        const nestedDispatch = createNestedDispatch(dispatch, key);
        const nestedGetState = () => getState()[key];
        return value(state[key], nestedDispatch, nestedGetState);
    }
    return value;
}));

/**
 * Creates an async action from the given function.
 *
 * The function must be of type (dispatch, getState) => undefined.
 */
export const createAsyncAction = func => (state, dispatch, getState) => {
    func(dispatch, getState);
    return getState();
};

const reduceActionsAccumulator = (a1, a2) => createAsyncAction(dispatch => {
    dispatch(a1);
    dispatch(a2);
});

/**
 * Reduces the actions into a single action.
 */
export const reduceActions = (...actions) => actions.reduce(reduceActionsAccumulator);


// Action creator utilities.

const bindActionCreator = (dispatch, actionCreator) => (...args) => dispatch(actionCreator(...args));

/**
 * Binds the given action creators to call dispatch with their
 * action when invoked.
 *
 * Any action creators with the name "initialize" will
 * be automatically invoked to set up initial state.
 */
export const bindActionCreators = (actionCreators, dispatch) => {
    const actions = assignWith({}, actionCreators, (actionCreator, key) => {
        if (isFunction(actionCreator)) {
            return bindActionCreator(dispatch, actionCreator);
        }
        return bindActionCreators(actionCreator, createNestedDispatch(dispatch, key));
    });
    const {initialize} = actions;
    if (isFunction(initialize)) {
        initialize();
    }
    return actions;
};

const reduceActionCreatorsAccumulator = (dst, src) => assignWith(dst, src, (actionCreator, key) => dst[key] ? reduceActionCreators(dst[key], actionCreator) : actionCreator);

/**
 * Reduces the action creators into a single action creator.
 */
export const reduceActionCreators = (...actionCreatorsList) => {
    // Combine multiple functions into a single reduced action creator.
    if (actionCreatorsList.every(isFunction)) {
        const reducedActionCreator = (...args) => reduceActions(...actionCreatorsList.map(actionCreator => actionCreator(...args)));
        // Preserve function annotations.
        assign(reducedActionCreator, ...actionCreatorsList);
        return reducedActionCreator;
    }
    // Merge nested action creators.
    return actionCreatorsList.reduce(reduceActionCreatorsAccumulator, {});
};
