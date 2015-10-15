// General-purpose utilities.

const assign = Object.assign;
const freeze = Object.freeze;
const keys = Object.keys;

const mapValues = (obj, func) => keys(obj).reduce((o, key) => {
    o[key] = func(obj[key], key);
    return o;
}, {});


// Type detection utilities.

const isFunction = value => typeof value === "function";

const isAsyncAction = value => value && isFunction(value._asyncAction);


// Async actions.

/**
 * Creates an async action from the given function.
 *
 * The function must be of type ({getState, resolve, dispatch}) => action.
 *
 * This needs to be used in conjunction with asyncActionMiddleware.
 */
export const createAsyncAction = func => ({_asyncAction: func});


// Stores.

const createUnsubscribe = (listeners, listener) => () => {
    const index = listeners.indexOf(listener);
    if (index != -1) {
        listeners.splice(index, 1);
    }
};

const defaultResolve = store => next => action => next(action);

/**
 * Creates a wrapped state object and returns two functions for
 * interacting with it.
 *
 * getState(): Returns a snapshot of the current state.
 * subscribe(listener): Will notify the listener on any change to the state,
 *     and immediately call the listener to notify of current state. Returns
 *     an unsubscribe function.
 * dispatch(action): Mutates the state using the given action. An action is a
 *     function that is called with the current state, and returns the new
 *     state.
 */
export const createStore = () => {
    let state;
    const getState = () => state;
    // Subscriptions management.
    const listeners = [];
    const subscribe = listener => {
        listeners.push(listener);
        listener(state);
        // The unsubscribe function.
        return createUnsubscribe(listeners, listener);
    };
    // State management.
    const dispatch = action => {
        if (!isFunction(action)) {
            throw new Error(`Actions should be plain functions: ${action}`);
        }
        state = action(state);
        listeners.forEach(listener => listener(state));
    };
    // All done!
    return {getState, subscribe, resolve: defaultResolve, dispatch};
};



// Middleware.

/**
 * Middleware used to process actions created by
 * createAsyncAction().
 */
export const asyncActionMiddleware = ({dispatch, getState}) => next => action => isAsyncAction(action) ? action._asyncAction(dispatch, getState) : next(action);

const enhanceStore = ({getState, resolve, dispatch: baseDispatch, ...store}) => {
    const dispatch = resolve({getState, resolve, dispatch: action => dispatch(action)})(baseDispatch);
    return {getState, resolve, dispatch, ...store};
};

const reduceMiddleware = middlewareList => store => {
    const boundMiddlewareList = middlewareList.map(m => m(store));
    return next => boundMiddlewareList.reduceRight((m2, m1) => m1(m2), next);
};

/**
 * Store enhancer that applies the given middleware.
 */
export const applyMiddleware = (...middlewareList) => createStore => (...args) => {
    const {resolve: baseResolve, ...store} = createStore(...args);
    const resolve = reduceMiddleware([...middlewareList, baseResolve]);
    return enhanceStore({resolve, ...store});
};


// Action creators.

/**
 * An action creator that will merge the existing
 * state with the new state.
 *
 * If any of the keys of the new state are actions,
 * then they will be called with the previous value
 * of the state at that key to mutate the existing
 * value.
 */
export const setState = obj => (state={}) => freeze(assign({}, state, mapValues(obj, (value, key) => isFunction(value) ? value(state[key]) : value)));

const bindActionCreator = (actionCreator, dispatch) => (...args) => {
    const action = actionCreator(...args);
    dispatch(action);
    return action;
};

const createNestedGetState = (getState, key) => () => (getState() || {})[key];

const createNestedDispatch = (dispatch, key) => action => dispatch(setState({[key]: action}));

const bindActionCreators = (actionCreators, {getState, dispatch, ...store}) => {
    // Bind objects of action creators.
    const actions = mapValues(actionCreators, (actionCreator, key) => {
        // Bind action creators.
        if (isFunction(actionCreator)) {
            return bindActionCreator(actionCreator, dispatch);
        }
        // Bind nested actions.
        return bindActionCreators(actionCreator, enhanceStore({
            getState: createNestedGetState(getState, key),
            dispatch: createNestedDispatch(dispatch, key),
            ...store
        }));
    });
    // Run the default action.
    const {initialize} = actions;
    if (isFunction(initialize)) {
        initialize();
    }
    // All done!
    return actions;
};

/**
 * Store enhancer that recursively binds an object of action creators to the
 * given store.
 *
 * If the object of action creators contains a "initialize"
 * key, then that action creator will be called automatically
 * to set initial state.
 *
 * The returned store will have an "actions" property.
 */
export const applyActionCreators = actionCreators => createStore => (...args) => {
    const store = createStore(...args);
    const actions = bindActionCreators(actionCreators, store);
    return {actions, ...store};
};
