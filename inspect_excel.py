import pandas as pd
import json

xl = pd.ExcelFile('Loymalila_SalesDataMart.xlsx')
print("Sheets:", xl.sheet_names)

for sheet in xl.sheet_names:
    df = pd.read_excel('Loymalila_SalesDataMart.xlsx', sheet_name=sheet)
    print(f"\nSheet: {sheet}")
    print(df.info())
    print(df.head(2))
