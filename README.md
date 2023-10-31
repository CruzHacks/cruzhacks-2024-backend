# CruzHacks 2024 Backend

## How to Run

1. Clone this repository
2. Install [firebase-tools](https://www.npmjs.com/package/firebase-tools) to
   emulate backend and run deploys
3. Navigate to the root of the repository and run `yarn` to install all
   the dependencies
4. Run `yarn start` to start the firebase emulators

## Available Scripts

- `yarn lint` -> lints code
- `yarn build` -> transpiles typescript into lib folder
- `yarn start` -> transpiles typescript and runs firebase emulators
- `yarn shell` -> transpiles typescript and runs interactive shell to test
  functions
- `yarn deploy` -> deploys firebase functions to firebase
- `yarn logs` -> print log to stdout
