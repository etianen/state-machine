import expect from "expect.js";
import {createStore, bindActionCreators, setState, createAsyncAction, reduceActions, reduceActionCreators} from "../";


describe("state-machine", () => {

    const actionCreators = reduceActionCreators({
        initialize: () => setState({
            foo: "foo"
        }),
        bar: {
            qux: {
                initialize: () => setState({
                    norf: "norf"
                }),
                setNorf: norf => setState({norf}),
                setNorfReduced: norf => setState({norf: undefined})
            }
        }
    }, {
        bar: {
            qux: {
                setNorfReduced: norf => setState({norf}),
                setNorfAsync: norf => createAsyncAction((dispatch, getState) => {
                    expect(getState()).to.eql({norf: "norf"});
                    dispatch(setState({norf}));
                })
            }
        }
    });

    const initialState = {
        foo: "foo",
        bar: {
            qux: {
                norf: "norf"
            }
        }
    };

    const stateWithFoo = {
        foo: "FOO",
        bar: {
            qux: {
                norf: "norf"
            }
        }
    };

    const stateWithNorf = {
        foo: "foo",
        bar: {
            qux: {
                norf: "NORF"
            }
        }
    };

    let getState, subscribe, dispatch, actions, history, unsubscribe;

    beforeEach(() => {
        const store = createStore();
        getState = store.getState;
        subscribe = store.subscribe;
        dispatch = store.dispatch;
        actions = bindActionCreators(actionCreators, dispatch);
        history = [];
        unsubscribe = subscribe(state => history.push(state));
    });


    describe("getState", () => {

        it("provides a snapshot of current state", () => {
            expect(getState()).to.eql(initialState);
        });

    });


    describe("subscribe", () => {

        it("provides subscribers with initial state", () => {
            expect(history).to.eql([initialState]);
        });

        it("notifies listeners of new state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("does not notify listeners of identical state", () => {
            dispatch(state => state);
            expect(history).to.eql([initialState]);
        });

        it("returns an unsubscribe function", () => {
            unsubscribe();
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState]);
        });

    });


    describe("setState", () => {

        it("allows state to be merged with existing state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("allows keys to be merged with existing values", () => {
            dispatch(setState({foo: f => f.toUpperCase()}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("allows selectors to be appled to the state", () => {
            dispatch(setState({}, {
                getFooUpper: state => state.foo.toUpperCase()
            }));
            expect(history).to.eql([initialState, initialState]);
            expect(history[1].getFooUpper()).to.be("FOO");
        });

        it("preserves existing state selectors", () => {
            dispatch(setState({}, {
                getFooUpper: state => state.foo.toUpperCase()
            }));
            dispatch(setState({}));
            expect(history).to.eql([initialState, initialState, initialState]);
            expect(history[1].getFooUpper()).to.be("FOO");
        });

    });


    describe("reduced action", () => {

        it("runs multiple actions in the order declared", () => {
            dispatch(reduceActions(
                setState({foo: undefined}),
                setState({foo: undefined}),
                setState({foo: "FOO"})
            ));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

    });


    describe("async action", () => {

        it("provides a dispatch function", () => {
            dispatch(createAsyncAction(dispatch => dispatch(setState({foo: "FOO"}))));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("provides a getState function", () => {
            dispatch(createAsyncAction((dispatch, getState) => {
                expect(getState()).to.eql(initialState);
            }));
        });

        it("debounces multiple synchronous calls to dispatch", () => {
            dispatch(createAsyncAction(dispatch => {
                dispatch(setState({foo: "bar"}));
                dispatch(setState({foo: "FOO"}));
            }));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

    });


    describe("nested action", () => {

        it("runs the dispatch function with the resolved action", () => {
            actions.bar.qux.setNorf("NORF");
            expect(history).to.eql([initialState, stateWithNorf]);
        });

        it("runs async actions", () => {
            actions.bar.qux.setNorfAsync("NORF");
            expect(history).to.eql([initialState, stateWithNorf]);
        });

    });


    describe("reduceActionCreators", () => {

        it("runs reduced action creators in the order declared", () => {
            actions.bar.qux.setNorfReduced("NORF");
            expect(history).to.eql([initialState, stateWithNorf]);
        });

    });


});
