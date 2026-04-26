from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/practice')
def practice():
    return render_template('practice.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/easter-egg')
def easter_egg():
    # The legendary Python easter egg
    import antigravity
    return {"status": "flying"}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
