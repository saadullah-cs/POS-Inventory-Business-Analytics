"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calculator, History, X, RotateCcw, Mic, MicOff, Volume2, VolumeX, Languages } from "lucide-react"

interface CalculationHistory {
  id: string
  expression: string
  result: string
  timestamp: Date
}

interface EnhancedCalculatorProps {
  isOpen: boolean
  onClose: () => void
}

export default function EnhancedCalculator({ isOpen, onClose }: EnhancedCalculatorProps) {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState("")
  const [operation, setOperation] = useState("")
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [history, setHistory] = useState<CalculationHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [autoCalculateDisplay, setAutoCalculateDisplay] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState("")
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ur'>('en')
  const calculatorRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const useHistoryValue = (value: string) => {
    setDisplay(value)
    setShowHistory(false)
  }

  // Voice input functionality
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = currentLanguage === 'ur' ? 'ur-PK' : 'en-US'
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceStatus(currentLanguage === 'ur' ? 'سن رہا ہے... اپنا حساب بولیں' : "Listening... Speak your calculation")
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim()
        setVoiceStatus(`Processing: "${transcript}"`)
        processVoiceInput(transcript)
      }

      recognition.onerror = (event: any) => {
        setIsListening(false)
        setVoiceStatus(`Error: ${event.error}. Try again.`)
        setTimeout(() => setVoiceStatus(""), 3000)
      }

      recognition.onend = () => {
        setIsListening(false)
        setTimeout(() => setVoiceStatus(""), 2000)
      }

      recognitionRef.current = recognition
      setSpeechSupported(true)
    } else {
      setSpeechSupported(false)
    }
  }, [])

  // Urdu number mappings
  const urduToEnglishNumbers: { [key: string]: string } = {
    'صفر': '0', 'شفر': '0', 'زیرو': '0',
    'ایک': '1', 'اک': '1', 'ون': '1',
    'دو': '2', 'ٹو': '2',
    'تین': '3', 'تھری': '3',
    'چار': '4', 'فور': '4',
    'پانچ': '5', 'فایو': '5',
    'چھ': '6', 'چے': '6', 'سکس': '6',
    'سات': '7', 'سیون': '7',
    'آٹھ': '8', 'ایٹ': '8',
    'نو': '9', 'نائن': '9',
    'دس': '10', 'ٹین': '10',
    'سو': '100', 'ہنڈرڈ': '100',
    'ہزار': '1000', 'تھاؤزنڈ': '1000'
  }

  // Urdu operation mappings
  const urduToEnglishOperations: { [key: string]: string } = {
    'جمع': '+', 'پلس': '+', 'اور': '+', 'میں': '+',
    'منہا': '-', 'مائنس': '-', 'کم': '-', 'سے': '-',
    'ضرب': '*', 'گنا': '*', 'ٹائمز': '*', 'ملٹپلای': '*',
    'تقسیم': '/', 'بانٹ': '/', 'ڈیوائیڈ': '/', 'بذریعہ': '/',
    'برابر': '=', 'ایکول': '=', 'کے': '='
  }

  const processVoiceInput = (transcript: string) => {
    try {
      // Auto-detect language based on script
      const containsUrdu = /[\u0600-\u06FF]/.test(transcript)
      const detectedLang = containsUrdu ? 'ur' : 'en'
      
      if (detectedLang !== currentLanguage) {
        setCurrentLanguage(detectedLang)
        setVoiceStatus(`Language detected: ${detectedLang === 'ur' ? 'اردو' : 'English'}`)  
      }

      // Clean and parse the voice input
      let cleanInput = transcript
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim()
      
      // Handle Urdu input
      if (detectedLang === 'ur') {
        // Replace Urdu numbers and operations
        Object.entries(urduToEnglishNumbers).forEach(([urdu, english]) => {
          cleanInput = cleanInput.replace(new RegExp(urdu, 'g'), english)
        })
        Object.entries(urduToEnglishOperations).forEach(([urdu, english]) => {
          cleanInput = cleanInput.replace(new RegExp(urdu, 'g'), english)
        })
        // Remove common Urdu phrases
        cleanInput = cleanInput.replace(/(کیا ہے|کتنا|حساب|گنتی)/g, '')
      } else {
        // Handle English input
        cleanInput = cleanInput
          .replace(/(what is|what's|calculate|compute)/gi, '')
          .replace(/plus/gi, '+')
          .replace(/minus/gi, '-')
          .replace(/times|multiplied by|multiply/gi, '*')
          .replace(/divided by|divide/gi, '/')
          .replace(/equals?/gi, '=')
          .replace(/point|dot/gi, '.')
          .replace(/zero/gi, '0')
          .replace(/one/gi, '1')
          .replace(/two/gi, '2')
          .replace(/three/gi, '3')
          .replace(/four/gi, '4')
          .replace(/five/gi, '5')
          .replace(/six/gi, '6')
          .replace(/seven/gi, '7')
          .replace(/eight/gi, '8')
          .replace(/nine/gi, '9')
          .replace(/ten/gi, '10')
          .replace(/hundred/gi, '00')
          .replace(/thousand/gi, '000')
      }

      // Extract numbers and operators
      const mathExpression = cleanInput.match(/[\d\+\-\*\/\.\=\s]+/g)?.[0]?.replace(/\s+/g, '') || ''
      
      if (mathExpression) {
        // Clear calculator first
        clear()
        
        // Parse and execute the expression
        const parts = mathExpression.split(/([\+\-\*\/])/)
        
        if (parts.length >= 3) {
          const firstNumber = parts[0]
          const operator = parts[1]
          const secondNumber = parts[2]
          
          if (firstNumber && operator && secondNumber) {
            // Input first number
            setDisplay(firstNumber)
            setPreviousValue(firstNumber)
            
            // Input operator
            setTimeout(() => {
              setOperation(operator)
              setWaitingForOperand(true)
              
              // Input second number and calculate
              setTimeout(() => {
                setDisplay(secondNumber)
                setWaitingForOperand(false)
                
                // Perform calculation
                setTimeout(() => {
                  const result = calculate(parseFloat(firstNumber), parseFloat(secondNumber), operator)
                  const expression = `${firstNumber} ${operator} ${secondNumber}`
                  addToHistory(expression, String(result))
                  setDisplay(String(result))
                  setPreviousValue("")
                  setOperation("")
                  setWaitingForOperand(true)
                  setVoiceStatus(detectedLang === 'ur' ? `نتیجہ: ${result}` : `Result: ${result}`)
                }, 100)
              }, 100)
            }, 100)
          }
        } else if (parts.length === 1 && /^[\d\.]+$/.test(parts[0])) {
          // Just a number
          setDisplay(parts[0])
          setVoiceStatus(detectedLang === 'ur' ? `نمبر: ${parts[0]}` : `Number: ${parts[0]}`)
        } else {
          setVoiceStatus(detectedLang === 'ur' ? 
            "سمجھ نہیں آیا۔ کوشش کریں: 'پانچ جمع تین' یا 'پندرہ گنا دو'" : 
            "Could not understand. Try: 'five plus three' or '15 times 2'")
        }
      } else {
        setVoiceStatus(detectedLang === 'ur' ? 
          "کوئی حساب نہیں ملا۔ ریاضی کا مسئلہ بولیں۔" : 
          "No calculation detected. Try speaking a math problem.")
      }
    } catch (error) {
      console.error('Voice processing error:', error)
      setVoiceStatus("Error processing voice input. Please try again.")
    }
  }

  const startVoiceInput = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error('Speech recognition error:', error)
        setVoiceStatus("Could not start voice recognition")
      }
    }
  }

  const stopVoiceInput = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }

  // Keyboard support
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return
    
    const key = event.key
    
    // Prevent default for calculator keys
    if (/[0-9\+\-\*\/\=\.]|Enter|Backspace|Delete|Escape/.test(key)) {
      event.preventDefault()
    }
    
    // Numbers
    if (/[0-9]/.test(key)) {
      inputNumber(key)
    }
    // Operators
    else if (key === '+') {
      inputOperation('+')
    }
    else if (key === '-') {
      inputOperation('-')
    }
    else if (key === '*') {
      inputOperation('*')
    }
    else if (key === '/') {
      inputOperation('/')
    }
    // Decimal point
    else if (key === '.') {
      inputDecimal()
    }
    // Calculate
    else if (key === '=' || key === 'Enter') {
      performCalculation()
    }
    // Clear
    else if (key === 'Escape') {
      clear()
    }
    // Backspace
    else if (key === 'Backspace') {
      backspace()
    }
    // Delete (Clear Entry)
    else if (key === 'Delete') {
      clearEntry()
    }
  }, [isOpen, display, previousValue, operation, waitingForOperand])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calculatorRef.current && !calculatorRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyPress)
      initializeSpeechRecognition()
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [isOpen, onClose, handleKeyPress, initializeSpeechRecognition])
  
  // Update speech recognition language when currentLanguage changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = currentLanguage === 'ur' ? 'ur-PK' : 'en-US'
    }
  }, [currentLanguage])

  useEffect(() => {
    if (previousValue && operation && display !== "0" && !waitingForOperand) {
      try {
        const currentValue = Number.parseFloat(previousValue)
        const inputValue = Number.parseFloat(display)
        const result = calculate(currentValue, inputValue, operation)
        setAutoCalculateDisplay(`${previousValue} ${operation} ${display} = ${result}`)
      } catch {
        setAutoCalculateDisplay("")
      }
    } else {
      setAutoCalculateDisplay("")
    }
  }, [display, previousValue, operation, waitingForOperand])

  // Load history from localStorage on component mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("calculator-history")
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory))
      }
    } catch (error) {
      console.error('Error loading calculator history:', error)
      // Clear corrupted history
      localStorage.removeItem("calculator-history")
      setHistory([])
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("calculator-history", JSON.stringify(history))
    } catch (error) {
      console.error('Error saving calculator history:', error)
    }
  }, [history])

  const addToHistory = (expression: string, result: string) => {
    const newEntry: CalculationHistory = {
      id: Date.now().toString(),
      expression,
      result,
      timestamp: new Date(),
    }
    setHistory((prev) => [newEntry, ...prev.slice(0, 49)]) // Keep only last 50 calculations
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem("calculator-history")
  }

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const inputOperation = (nextOperation: string) => {
    const inputValue = Number.parseFloat(display)

    if (previousValue === "") {
      setPreviousValue(display)
    } else if (operation) {
      const currentValue = Number.parseFloat(previousValue)
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(String(newValue))
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case "+":
        return firstValue + secondValue
      case "-":
        return firstValue - secondValue
      case "*":
        return firstValue * secondValue
      case "/":
        return firstValue / secondValue
      case "=":
        return secondValue
      default:
        return secondValue
    }
  }

  const performCalculation = () => {
    const inputValue = Number.parseFloat(display)

    if (previousValue !== "" && operation) {
      const currentValue = Number.parseFloat(previousValue)
      const newValue = calculate(currentValue, inputValue, operation)
      const expression = `${previousValue} ${operation} ${display}`

      addToHistory(expression, String(newValue))
      setDisplay(String(newValue))
      setPreviousValue("")
      setOperation("")
      setWaitingForOperand(true)
      setAutoCalculateDisplay("") // Clear auto-calculation display
    }
  }

  const clear = () => {
    setDisplay("0")
    setPreviousValue("")
    setOperation("")
    setWaitingForOperand(false)
    setAutoCalculateDisplay("") // Clear auto-calculation display
  }

  const clearEntry = () => {
    setDisplay("0")
  }

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.")
      setWaitingForOperand(false)
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".")
    }
  }

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay("0")
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - subtle on mobile, none on desktop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[99] animate-in fade-in-0 duration-200 lg:hidden"
        onClick={onClose}
      />
      
      {/* Calculator - Floating widget docked neatly at bottom-right of screen */}
      <div 
        ref={calculatorRef}
        className="
          fixed 
          bottom-3 right-3 
          w-[calc(100vw-1.5rem)] 
          sm:bottom-4 sm:right-4 
          sm:w-[340px] 
          max-h-[calc(100vh-1rem)]
          flex flex-col
          z-[100] 
          bg-white dark:bg-gray-800 
          rounded-xl 
          shadow-2xl 
          overflow-hidden 
          border border-gray-200 dark:border-gray-700
          animate-in 
          slide-in-from-bottom-2 
          fade-in-0 
          duration-200
        "
        style={{
          transformOrigin: 'bottom right',
        }}
      >
        {/* Header - Compact modern gradient */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calculator className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-gray-800 dark:text-white truncate">
              {currentLanguage === 'ur' ? 'ذہین کیلکولیٹر' : 'Smart Calculator'}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentLanguage(currentLanguage === 'en' ? 'ur' : 'en')}
              className="h-7 px-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              title={`Switch to ${currentLanguage === 'en' ? 'Urdu' : 'English'}`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="text-[10px]">{currentLanguage === 'en' ? 'اُردو' : 'EN'}</span>
            </Button>
            {speechSupported && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                className={`h-7 w-7 p-0 ${
                  isListening 
                    ? "text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20" 
                    : "text-green-600 hover:text-green-700 dark:text-green-400"
                }`}
                title={isListening ? (currentLanguage === 'ur' ? "آواز بند کریں" : "Stop Voice Input") : (currentLanguage === 'ur' ? "آواز شروع کریں" : "Start Voice Input")}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="h-7 w-7 p-0 text-gray-600 hover:text-blue-600 dark:text-gray-400"
              title="History"
            >
              <History className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-gray-600 hover:text-red-600 dark:text-gray-400"
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-2.5 sm:p-3 overflow-y-auto flex-1 overscroll-contain">
          {/* Voice Status */}
          {voiceStatus && (
            <div className="mb-2 p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center gap-1.5">
                {isListening ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                    <Volume2 className="w-3.5 h-3.5 text-red-600" />
                  </div>
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span className="text-xs text-blue-800 dark:text-blue-200">{voiceStatus}</span>
              </div>
            </div>
          )}
          
          {/* Display */}
          <div className="mb-2 sm:mb-2.5">
            <div className="bg-gray-50 dark:bg-gray-700/80 rounded-lg px-2.5 py-1.5 border border-gray-100 dark:border-gray-600">
              <div className="flex items-center justify-between text-xs mb-0.5 h-4">
                <span className="text-gray-400 dark:text-gray-400 truncate text-[11px]">
                  {previousValue && operation ? `${previousValue} ${operation}` : ""}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px] truncate">
                  {autoCalculateDisplay}
                </span>
              </div>
              <Input
                value={display}
                readOnly
                className="text-right text-xl sm:text-2xl font-mono font-semibold border-0 bg-transparent p-0 h-7 sm:h-8 focus:ring-0 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {showHistory ? (
            /* History Panel */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Calculation History</h4>
                <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 px-1.5 text-xs text-red-600 hover:text-red-700">
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {history.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-3 text-xs">No calculations yet</p>
                ) : (
                  history.map((calc) => (
                    <div
                      key={calc.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => setDisplay(calc.result)}
                    >
                      <div className="text-xs text-gray-600 dark:text-gray-400">{calc.expression}</div>
                      <div className="font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">= {calc.result}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {calc.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Calculator Buttons - Compact single-screen layout */
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {/* Row 1 */}
              <Button
                variant="outline"
                onClick={clear}
                className="h-8 sm:h-9 text-red-600 hover:text-red-700 bg-transparent text-xs sm:text-sm font-semibold p-0"
              >
                AC
              </Button>
              <Button
                variant="outline"
                onClick={clearEntry}
                className="h-8 sm:h-9 bg-transparent text-xs sm:text-sm font-medium p-0"
              >
                CE
              </Button>
              <Button
                variant="outline"
                onClick={backspace}
                className="h-8 sm:h-9 bg-transparent text-xs sm:text-sm p-0"
              >
                ⌫
              </Button>
              <Button
                variant="outline"
                onClick={() => inputOperation("/")}
                className="h-8 sm:h-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm sm:text-base font-semibold p-0"
              >
                ÷
              </Button>

              {/* Row 2 */}
              <Button variant="outline" onClick={() => inputNumber("7")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                7
              </Button>
              <Button variant="outline" onClick={() => inputNumber("8")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                8
              </Button>
              <Button variant="outline" onClick={() => inputNumber("9")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                9
              </Button>
              <Button
                variant="outline"
                onClick={() => inputOperation("*")}
                className="h-8 sm:h-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm sm:text-base font-semibold p-0"
              >
                ×
              </Button>

              {/* Row 3 */}
              <Button variant="outline" onClick={() => inputNumber("4")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                4
              </Button>
              <Button variant="outline" onClick={() => inputNumber("5")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                5
              </Button>
              <Button variant="outline" onClick={() => inputNumber("6")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                6
              </Button>
              <Button
                variant="outline"
                onClick={() => inputOperation("-")}
                className="h-8 sm:h-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm sm:text-base font-semibold p-0"
              >
                −
              </Button>

              {/* Row 4 */}
              <Button variant="outline" onClick={() => inputNumber("1")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                1
              </Button>
              <Button variant="outline" onClick={() => inputNumber("2")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                2
              </Button>
              <Button variant="outline" onClick={() => inputNumber("3")} className="h-8 sm:h-9 text-xs sm:text-sm font-medium p-0">
                3
              </Button>
              <Button
                variant="outline"
                onClick={() => inputOperation("+")}
                className="h-auto bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 row-span-2 text-sm sm:text-base font-semibold p-0"
              >
                +
              </Button>

              {/* Row 5 */}
              <Button
                variant="outline"
                onClick={() => inputNumber("0")}
                className="h-8 sm:h-9 col-span-2 text-xs sm:text-sm font-medium p-0"
              >
                0
              </Button>
              <Button
                variant="outline"
                onClick={inputDecimal}
                className="h-8 sm:h-9 bg-transparent text-xs sm:text-sm font-medium p-0"
              >
                .
              </Button>

              {/* Equals button */}
              <Button
                onClick={performCalculation}
                className="h-8 sm:h-9 bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm font-bold p-0 shadow-sm"
              >
                =
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
