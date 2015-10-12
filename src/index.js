import isFunction from "lodash/lang/isFunction";
import pull from "lodash/array/pull";
import assign from "lodash/object/assign";
import mapValues from "lodash/object/mapValues";


const freeze = Object.freeze;


// Type detection utilities.

const isObservable = value => value && isFunction(value.subscribe) && isFunction(value.forEach);

const isPromise = value => value && isFunction(value.then);

const isIterator = value => value && isFunction(value.next);


const createUpdate = (baseUpdate, middleware) => {
    const update = middleware(action => update(action), baseUpdate);
    update._middleware = middleware;
    update._baseUpdate = baseUpdate;
    return update;
};


const baseMiddleware = (update, next) => action => {
    if (!isFunction(action)) {
        throw new Error(`Actions should be plain functions: ${action}`);
    }
    next(action);
};


/**
 * Creates a wrapped state object and returns two functions for
 * interacting with it.
 *
 * subscribe(listener): Will notify the listener on any change to the state,
 *     and immediately call the listener to notify of current state. Returns
 *     an unsubscribe function.
 * update(action): Mutates the state using the given action. An action is a
 *     function that is called with the current state, and returns the new
 *     state.
 */
export const createMachine = () => {
    let state;
    const getState = () => state;
    // Subscriptions management.
    const listeners = [];
    const subscribe = listener => {
        listeners.push(listener);
        listener(state);
        // The unsubscribe function.
        return () => pull(listeners, listener);
    };
    // State management.
    const update = createUpdate(action => {
        state = action(state);
        listeners.forEach(listener => listener(state));
    }, baseMiddleware);
    // All done!
    return {getState, subscribe, update};
};


/**
 * Merges the array of middleware into a single middleware
 * function.
 */
export const reduceMiddleware = middlewareList => middlewareList.reduceRight((m2, m1) => (update, next) => m1(update, m2(update, next)));

/**
 * Returns a new update function that will use the given
 * array of middleware to resolve actions.
 */
export const applyMiddleware = (middlewareList, update) => createUpdate(update._baseUpdate, reduceMiddleware([...middlewareList, update._middleware]));


// Built-in middleware.

export const observableMiddleware = (update, next) => action => isObservable(action) ? action.forEach(update) : next(action);

export const promiseMiddleware = (update, next) => action => isPromise(action) ? action.then(update) : next(action);

export const iteratorMiddleware = (update, next) => action => isIterator(action) ? Array.from(action, update) : next(action);

export const defaultMiddleware = reduceMiddleware([observableMiddleware, promiseMiddleware, iteratorMiddleware]);


// Action creators.

const mergeStateProperty = (oldValue, value) => isFunction(value) ? value(oldValue) : value;

/**
 * An action creator that will merge the existing
 * state with the new state.
 *
 * If any of the keys of the new state are actions,
 * then they will be called with the previous value
 * of the state at that key to mutate the existing
 * value.
 */
export const setState = obj => state => freeze(assign(assign({}, state), obj, mergeStateProperty));


/**
 * Recursively binds an object of action creators to the
 * given update function.
 *
 * If the object of action creators contains a "default"
 * key, then that action creator will be called automatically
 * to set initial state.
 */
export const bindActionCreators = (actionCreators, update) => {
    // Bind objects of action creators.
    const boundActionCreators = mapValues(actionCreators, (actionCreator, key) => {
        // Bind action creators.
        if (isFunction(actionCreator)) {
            return (...args) => update(actionCreator(...args));
        }
        // Bind nested actions.
        return bindActionCreators(actionCreator, createUpdate(action => update(setState({[key]: action})), update._middleware));
    });
    // Run the default action.
    const {default: initializer} = boundActionCreators;
    if (isFunction(initializer)) {
        initializer();
    }
    // All done!
    return boundActionCreators;
};


/**
 * An action helper that returns an iterator of the
 * given actions.
 *
 * This should be used in combination with iteratorMiddleware.
 */
export const chainActions = (...actions) => actions[Symbol.iterator]();


/**
 * Top-level API for creating a state machine application.
 */
export const createApp = (actionCreators={}, middlewareList=[defaultMiddleware]) => {
    const {getState, subscribe, update: baseUpdate} = createMachine();
    const update = applyMiddleware(middlewareList, baseUpdate);
    const actions = bindActionCreators(actionCreators, update);
    return {getState, subscribe, update, actions};
};
