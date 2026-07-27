import pandas as pd
from sqlalchemy import create_engine

# =========================================
# PostgreSQL Config
# =========================================
DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

# =========================================
# CSV FILE
# =========================================
CSV_FILE = r"C:\inetpub\wwwroot\threat\LogsHillstoneDaily.csv"

# =========================================
# READ CSV
# =========================================
try:
    df = pd.read_csv(
        CSV_FILE,
        encoding='utf-8-sig',
        low_memory=False
    )

    print("โหลด CSV สำเร็จ")

except Exception as e:
    print(f"โหลด CSV ไม่สำเร็จ : {e}")
    exit()

# =========================================
# REMOVE HEADER ROW IF EXISTS
# =========================================
df = df.iloc[:]

# =========================================
# SELECT COLUMN BY NAME
# =========================================
df = pd.DataFrame({
    'threat_name': df['Threat Name'],
    'threat_type': df['Threat Type'],
    'threat_subtype': df['Threat Subtype'],
    'severity': df['Severity'],

    'source_ip': df['Source'],
    'source_port': df['Port'],

    'destination_ip': df['Destination'],
    'destination_port': df['Port.1'],

    'source_interface': df['Source Interface'],
    'destination_interface': df['Destination Interface'],

    'application_protocol': df['Application/Protocol'],

    'action': df['Action'],

    'attack_start_time': df['Attack Start Time'],
    'attack_end_time': df['Attack End Time'],

    'detected_by': df['Detected by'],
    'addition_by': df['Addition Info']
})

# =========================================
# CONVERT DATETIME
# =========================================
df['attack_start_time'] = pd.to_datetime(
    df['attack_start_time'],
    format='%Y/%m/%d %H:%M:%S',
    errors='coerce'
)

df['attack_end_time'] = pd.to_datetime(
    df['attack_end_time'],
    format='%Y/%m/%d %H:%M:%S',
    errors='coerce'
)

# =========================================
# CLEAN PORT
# =========================================
df['source_port'] = pd.to_numeric(
    df['source_port'],
    errors='coerce'
)

df['destination_port'] = pd.to_numeric(
    df['destination_port'],
    errors='coerce'
)

# =========================================
# CLEAN NULL
# =========================================
df = df.where(pd.notnull(df), None)

# =========================================
# TRUNCATE LONG FIELDS
# =========================================
df['addition_by'] = df['addition_by'].astype(str).str[:255]

# =========================================
# SHOW DATA
# =========================================
print("\n===== DATA SAMPLE =====")
print(df.head())

# =========================================
# CONNECT PostgreSQL
# =========================================
try:
    engine = create_engine(
        f'postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    )

    print("\nเชื่อมต่อ PostgreSQL สำเร็จ")

except Exception as e:
    print(f"เชื่อมต่อ PostgreSQL ไม่สำเร็จ : {e}")
    exit()

# =========================================
# INSERT DATABASE
# =========================================
try:
    df.to_sql(
        'logs_cyber',
        engine,
        if_exists='append',
        index=False,
        chunksize=1000
    )

    print("\nImport Success")

except Exception as e:
    print(f"\nImport Error : {e}")