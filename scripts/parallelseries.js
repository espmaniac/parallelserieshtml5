var onSeries = null;
var onParallel = null;

class Delta {
    constructor() {
      this.a = 0;
      this.b = 0;
      this.c = 0;
    }
}
  
class Star {
    constructor() {
      this.a = 0;
      this.b = 0;
      this.c = 0;
    }
}
  
const PREFIXES = [
    {
      symbol: "T",
      name: "tera",
      exponent: 12
    },
    {
      symbol: "G",
      name: "giga",
      exponent: 9
    },
    {
      symbol: "M",
      name: "mega",
      exponent: 6
    },
    {
      symbol: "k",
      name: "kilo",
      exponent: 3
    },
    {
      symbol: "m",
      name: "milli",
      exponent: -3
    },
    {
      symbol: "u",
      name: "micro",
      exponent: -6
    },
    {
      symbol: "n",
      name: "nano",
      exponent: -9
    },
    {
      symbol: "p",
      name: "pico",
      exponent: -12
    },
];

const CHARS = 1;
const NUMBER = 2;
const SERIES = '+';
const PARALLEL = 4;

/*
function isChar(key) {
	return (key >= 'a' && key <= 'z' || key >= 'A' && key <= 'Z');
}

function isNumber(key) {
	return (key >= '0' && key <= '9');
}
*/

function isChar(key) {
    return /^[a-zA-Z]+$/.test(key);
}

function isNumber(key) {
    return /^\d+$/.test(key);
}

function isWhiteSpace(key) {
    return /\s/.test(key);
}

class ParallelSeries {
    constructor() {
        this.expr = "";
        this.onParallel = null;
        this.onSeries = null;

        this.lexer = {
            index: 0,
            token: {
              type: 0,
              value: ""
            },
            fail: false,
            busy: false
        };
    }

    primary() {
		this.getToken();

		switch (this.lexer.token.type) {
			case '(': {
				let parens = this.solve();
				if (this.lexer.token.type != ')')
					this.error(") expected");
				this.getToken();	
				return parens;
			}

			case NUMBER: {
				let save = Object.assign({}, this.lexer);
				let result = parseFloat(this.lexer.token.value);

				this.getToken();

				if (this.lexer.token.type == CHARS) {
					let exponent = 0;

					for (let i = 0; i < (PREFIXES.length); ++i) {
						let prefix = PREFIXES[i];
						if (
							prefix.symbol === this.lexer.token.value 
							||
							prefix.name === this.lexer.token.value
						) {
							exponent = prefix.exponent;
							break;
						}
					}

					if (exponent !== 0)
						result *= Math.pow(10, exponent);
					else
						this.error("unknown metric");

				} else {
					this.lexer = save;
                }
				
				return result;
			}

			case '-': { // unary
				return -this.primary();
			}

			case '+': { // unary
				return this.primary();
			}

			default: {
				this.lexer.busy = true;
				this.error("primary expected");
				return 0;
			}

		}
	}

    solve() {
        let left = this.primary();

		this.getToken();
        for(;!this.lexer.fail;) {
			switch(this.lexer.token.type) {
				case SERIES: {
					if (this.onSeries === null) {
						this.error("onSeries = null");
						return 0;
					}
					left = this.onSeries(left, this.solve());
					this.getToken();
					break;
				}
				case PARALLEL: {
					if (this.onParallel === null) {
						this.error("onParallel = null");
						return 0;
					}
					left = this.onParallel(left, this.primary());
					this.getToken();
					break;
				}

				default: {
					this.lexer.busy = true;
					return left;
				}
			}
		}
		return 0;
    }

    getToken() {
        if (this.lexer.busy == true || this.lexer.fail == true) {
            this.lexer.busy = false;
            return;
        }
    
        this.lexer.token.value = "";
        this.lexer.token.type = -1;
        for (let c = this.expr.charAt(this.lexer.index); this.lexer.index < this.expr.length; c = this.expr.charAt(++this.lexer.index)) {
            if (isWhiteSpace(c) == true ||c == '\0' || c == '\n' || c == '\t') continue;
            else if(isChar(c)) {
                this.lexer.token.type = CHARS;
			    for (; isChar(c); c = this.expr.charAt(++this.lexer.index))
				    this.lexer.token.value += c;
            }
            else if (isNumber(c)) {
                this.lexer.token.type = NUMBER;
                for (; isNumber(c); c = this.expr.charAt(++this.lexer.index))
                    this.lexer.token.value += c;
    
                
                if ((c === '.' || c === ',') && isNumber(this.expr.charAt(this.lexer.index + 1))) {
                    // the parseFloat function can ignore the comma
                    this.lexer.token.value += '.'; // '.' || ','
                    c = this.expr.charAt(++this.lexer.index); // next number
    
                    for (; isNumber(c); c = this.expr.charAt(++this.lexer.index))
                        this.lexer.token.value += c;
                }
                
            }
            else if (c === '-' || c === '+' || c === '(' || c === ')') {
                this.lexer.token.type = c;
                ++this.lexer.index;
                break;
            }
            else if ((c == '|' || c == '/') && this.expr.charAt(this.lexer.index + 1) == c) {
                this.lexer.token.type = PARALLEL;
                this.lexer.index += 2;
            }
            else {
                this.error("bad token: " + c);
            }

            return;
        }
    }

    error(msg) {
        this.lexer.fail = true;
        console.error("ParallelSeries ERROR: " + msg);
    }

}

