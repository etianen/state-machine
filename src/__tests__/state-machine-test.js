import expect from "expect.js";
import {createStore, applyMiddleware, applyActionCreators, createAsyncAction, asyncActionMiddleware, setState} from "../";


describe("state-machine", () => {

    const actionCreators = {
        initialize: () => setState({
            foo: "foo"
        }),
        bar: {
            initialize: () => setState({
                baz: "baz"
            }),
            setBaz: baz => setState({baz}),
            setBazAsync: baz => createAsyncAction((dispatch, getState) => {
                expect(getState()).to.eql({baz: "baz"});
                dispatch(setState({baz}));
            })
        }
    };

    const expectedInitialState = {
        foo: "foo",
        bar: {
            baz: "baz"
        }
    };

    const stateWithFoo = {
        foo: "FOO",
        bar: {
            baz: "baz"
        }
    };

    const stateWithBaz = {
        foo: "foo",
        bar: {
            baz: "BAZ"
        }
    };

    let getState, subscribe, dispatch, actions, history, unsubscribe;

    beforeEach(() => {
        const createStoreWithMiddleware = applyMiddleware(asyncActionMiddleware)(createStore);
        const createStoreWithActions = applyActionCreators(actionCreators)(createStoreWithMiddleware);
        const store = createStoreWithActions();
        getState = store.getState;
        subscribe = store.subscribe;
        dispatch = store.dispatch;
        actions = store.actions;
        history = [];
        unsubscribe = subscribe(state => history.push(state));
    });


    describe("getState", () => {

        it("provides a snapshot of current state", () => {
            expect(getState()).to.eql(expectedInitialState);
        });

    });


    describe("subscribe", () => {

        it("provides subscribers with initial state", () => {
            expect(history).to.eql([expectedInitialState]);
        });

        it("notifies listeners of new state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([expectedInitialState, stateWithFoo]);
        });

        it("returns an unsubscribe function", () => {
            unsubscribe();
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([expectedInitialState]);
        });

    });


    describe("asyncActionMiddleware", () => {

        it("resolves async actions", () => {
            dispatch(createAsyncAction(dispatch => dispatch(setState({foo: "FOO"}))));
            expect(history).to.eql([expectedInitialState, stateWithFoo]);
        });

    });


    describe("setState", () => {

        it("allows state to be merged with existing state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([expectedInitialState, stateWithFoo]);
        });

        it("allows keys to be merged with existing values", () => {
            dispatch(setState({foo: f => f.toUpperCase()}));
            expect(history).to.eql([expectedInitialState, stateWithFoo]);
        });

    });


    describe("action", () => {

        it("runs the dispatch function with the resolved action", () => {
            actions.bar.setBaz("BAZ");
            expect(history).to.eql([expectedInitialState, stateWithBaz]);
        });

        it("resolves async actions", () => {
            actions.bar.setBazAsync("BAZ");
            expect(history).to.eql([expectedInitialState, stateWithBaz]);
        });

    });

});
