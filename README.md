## Healthify

Healthify is an application that generates optimized grocery lists for users based on their health and fitness goals (see `app.py` and the `screens/` directory).
The long term goal is for grocery lists to be generated, and grocery stores (Walmart, Costco, etc) near the user's current location to be shown and being able to directly buy them on this app.  

DISCLAIMER: This app is still under development. 

### Requirements

- **Python**: 3.9+ recommended
- **Dependencies**: Install from `requirements.txt` (if present) or your existing environment

```bash
pip install -r requirements.txt
```

If you don’t have a `requirements.txt` yet, you can generate one from your current environment (for example, with `pip freeze > requirements.txt`).

### Running the app

From the `src` directory:

```bash
python app.py
```

Adjust the command if you normally use a different entry point or virtual environment (e.g., `python3`, `poetry run`, or `pipenv run`).

### Project structure

- **`app.py`**: Main application file.
- **`screens/`**: Screen-specific modules (e.g., `test.py`).

Feel free to update this `README.md` with more detailed setup, usage instructions, and screenshots as the project evolves.
