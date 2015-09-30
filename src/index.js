// Type detection utilities.

const isFunction = value => typeof value === "function";

const isIterator = value => value && isFunction(value.next);

const isPromise = value => value && isFunction(value.then);

const isObservable = value => value && isFunction(value.subscribe) && isFunction(value.forEach);


// Iteration utilities.

const mapValues = (obj, func) => Object.keys(obj).reduce((newObj, key) => {
    newObj[key] = func(obj[key], key);
    return newObj;
}, {});


/**
 * Creates and returns a new record object.
 *
 * Record objects are immutable objects with string keys
 * and immutable values.
 */
export const createRecord = (...args) => Object.freeze(Object.assign({}, ...args));


const EMPTY_RECORD = createRecord();


const createUpdate = (baseUpdate, resolver) => {
    const update = action => resolver(update, () => baseUpdate(action), action);
    update.resolver = resolver;
    return update;
};


const baseResolver = (resolve, next, action) => {
    if (!isFunction(action)) {
        throw new Error(`Actions should be plain functions: ${action}`);
    }
    next();
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
    // Subscriptions management.
    const listeners = [];
    const subscribe = listener => {
        listeners.push(listener);
        listener(state);
        // The unsubscribe function.
        return () => listeners.splice(listeners.indexOf(listener), 1);
    };
    // State management.
    const update = createUpdate(action => {
        state = action(state);
        listeners.forEach(listener => listener(state));
    }, baseResolver);
    // All done!
    return {subscribe, update};
};


/**
 * Merges the array of middleware into a single middleware
 * function.
 */
export const reduceMiddleware = middleware => middleware.reduceRight((m1, m2) => (resolve, next, action) => m1(resolve, () => m2(resolve, next, action), action));

/**
 * Returns a new update function that will use the given
 * array of middleware to resolve actions.
 */
export const applyMiddleware = (middleware, update) => createUpdate(update, reduceMiddleware(middleware));


// Built-in middleware.

export const iteratorMiddleware = (resolve, next, action) => isIterator(action) ? Array.from(action).forEach(resolve) : next();

export const promiseMiddleware = (resolve, next, action) => isPromise(action) ? action.then(resolve) : next();

export const observableMiddleware = (resolve, next, action) => isObservable(action) ? action.forEach(resolve) : next();

export const defaultMiddleware = reduceMiddleware([iteratorMiddleware, promiseMiddleware, observableMiddleware]);


/**
 * An action creator that will replace the existing state
 * with the new state.
 */
export const replaceState = obj => () => obj;


/**
 * An action creator that will merge the existing
 * state with the new state.
 *
 * If any of the keys of the new state are actions,
 * then they will be called with the previous value
 * of the state at that key to mutate the existing
 * value.
 */
export const setState = obj => (state=EMPTY_RECORD) => createRecord(state, mapValues(obj, (value, key) => (isFunction(value) ? value(state[key]) : value)));


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
    const {default: initializer, ...boundActionCreators} = mapValues(actionCreators, (actionCreator, key) => {
        // Bind action creators.
        if (isFunction(actionCreator)) {
            return (...args) => update(actionCreator(...args));
        }
        // Bind nested actions.
        return bindActionCreators(actionCreator, createUpdate(action => update(setState({[key]: action})), update.resolver));
    });
    // Run the default action.
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
export const createApp = (actionCreators={}, middleware=[defaultMiddleware]) => {
    const {subscribe, update: baseUpdate} = createMachine();
    const update = applyMiddleware(middleware, baseUpdate);
    const actions = bindActionCreators(actionCreators, update);
    return {subscribe, update, actions};
};
