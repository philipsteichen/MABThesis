# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Master of Agribusiness (MAB) thesis project by Phil Steichen for Kansas State University, focused on commodity futures price prediction. The project implements machine learning models to predict grain futures prices using multiple data sources and forecasting approaches.

## Core Components

### Price Prediction Models
- **LSTM Neural Network** (`main1.py`, `model_thesis.ipynb`): Deep learning model using TensorFlow/Keras for corn futures (ZC=F) price prediction with 60-day lookback windows
- **Prophet Forecasting** (`barchart_prophet.py`, `stream.py`): Facebook Prophet implementation for time series forecasting of cash grain prices

### Data Processing
- **Barchart Data Combinator** (`Barchart_combinorator.py`): Combines futures contract data across different expiration months (Sept, May, Mar, July, Dec) from the `BarchartFutures/` directory
- **Data Sources**:
  - Barchart futures data (stored in `BarchartFutures/` with monthly subdirectories)
  - Parcell grain prices (`Parcell_GrainPrices_August-2024.xlsx`)
  - Yahoo Finance data via `yfinance` library

### Web Interface
- **Streamlit Dashboard** (`stream.py`): Interactive web application with three main features:
  - Yahoo Finance futures prediction
  - Custom dataset upload and analysis
  - HedgeAI comparison tool for different locations

## Development Commands

### Running the Application
```bash
# Start the Streamlit web interface
streamlit run stream.py

# Run individual Python scripts
python main1.py                    # LSTM model training and prediction
python Barchart_combinorator.py    # Data combination pipeline
python barchart_prophet.py         # Prophet forecasting
```

### Data Analysis
```bash
# Open Jupyter notebooks for interactive analysis
jupyter notebook model_thesis.ipynb        # Main model development
jupyter notebook scratch.ipynb             # Experimental work
jupyter notebook Barchart_Data_cleaning.ipynb  # Data preprocessing
```

## Key Dependencies

The project relies on these major libraries:
- **Machine Learning**: `tensorflow`, `scikit-learn`, `prophet`
- **Data Processing**: `pandas`, `numpy`, `pandas_datareader`
- **Visualization**: `matplotlib`, `plotly`, `streamlit`
- **Financial Data**: `yfinance`

## Data Structure

### Barchart Futures Directory
```
BarchartFutures/
├── Combined data/          # Output directory for combined datasets
├── Sept/                  # September contract data
├── May/                   # May contract data
├── Mar/                   # March contract data
├── July/                  # July contract data
└── Dec/                   # December contract data
```

### Key Data Files
- `final_combined.csv`: Master dataset combining all monthly contracts
- `barchart_wednesdays.csv`: Weekly Barchart data subset
- Excel files contain historical cash grain prices and market data

## Architecture Notes

- The LSTM model uses a 60-day prediction window with three LSTM layers and dropout regularization
- Prophet models are configured for seasonal decomposition of price trends
- Streamlit provides a modular interface with separate functions for different prediction methods
- Data combination pipeline processes monthly futures contracts into unified datasets
- All models target grain commodity price prediction (corn, wheat, soybeans)

## Credentials

The `creds.py` file contains authentication credentials for data APIs - ensure this file is properly configured for your data sources.