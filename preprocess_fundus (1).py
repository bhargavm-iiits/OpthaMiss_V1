import os
import pandas as pd
import numpy as np
import shutil
from PIL import Image
import json
from sklearn.model_selection import train_test_split
from tqdm import tqdm

# ----------------------------------------------------------------------
# 1. Configuration
# ----------------------------------------------------------------------
ODIR_ROOT = "ODIR"
RFMID_ROOT = "RFMID"
OUTPUT_ROOT = "processed_data"
TRAIN_SPLIT = 0.8
RANDOM_SEED = 42

CLASSES = ['N', 'D', 'G', 'C', 'A', 'H', 'M', 'O']

# ----------------------------------------------------------------------
# 2. Mapping RFMiD labels to ODIR classes
# ----------------------------------------------------------------------
ALL_RFMID_COLUMNS = [
    'DR','ARMD','MH','DN','MYA','BRVO','TSLN','ERM','LS','MS','CSR','ODC','CRVO',
    'TV','AH','ODP','ODE','ST','AION','PT','RT','RS','CRS','EDN','RPEC','MHL','RP',
    'CWS','CB','ODPM','PRH','MNF','HR','CRAO','TD','CME','PTCR','CF','VH','MCA','VS',
    'BRAO','PLQ','HPED','CL'
]
MAPPING = {
    'DR': 'D', 'DN': 'D',
    'ODC': 'G',
    'ARMD': 'A',
    'HR': 'H',
    'MYA': 'M',
}
rfmid_to_odir = {col: MAPPING.get(col, 'O') for col in ALL_RFMID_COLUMNS}

# ----------------------------------------------------------------------
# 3. Helper function to find image files (handles extensions)
# ----------------------------------------------------------------------
def find_image_file(base_folder, base_name):
    if '.' in base_name:
        candidate = os.path.join(base_folder, base_name)
        if os.path.exists(candidate):
            return candidate
    name_part = os.path.splitext(base_name)[0] if '.' in base_name else base_name
    for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
        candidate = os.path.join(base_folder, name_part + ext)
        if os.path.exists(candidate):
            return candidate
    return None

# ----------------------------------------------------------------------
# 4. Load ODIR data with progress
# ----------------------------------------------------------------------
print("Loading ODIR data...")
odir_df = pd.read_csv(os.path.join(ODIR_ROOT, "full_df.csv"))
odir_label_cols = CLASSES
odir_df['labels'] = odir_df[odir_label_cols].values.tolist()
odir_df['source'] = 'ODIR'

odir_image_base_folder = os.path.join(ODIR_ROOT, "ODIR-5K", "Training Images")

# Use tqdm for progress on apply
tqdm.pandas(desc="Finding ODIR images")
def get_odir_image_path(row):
    filename = os.path.basename(row['filepath'])
    return find_image_file(odir_image_base_folder, filename)

odir_df['image_path'] = odir_df.progress_apply(get_odir_image_path, axis=1)
initial_len = len(odir_df)
odir_df = odir_df[odir_df['image_path'].notna()]
print(f"ODIR: found {len(odir_df)} images out of {initial_len}")

odir_data = odir_df[['image_path', 'labels', 'source']].copy()

# ----------------------------------------------------------------------
# 5. Load RFMiD data with progress
# ----------------------------------------------------------------------
print("Loading RFMiD data...")
rfmid_frames = []
for set_name, csv_path, img_folder in [
    ('train', os.path.join(RFMID_ROOT, "Training_Set", "RFMiD_Training_Labels.csv"),
              os.path.join(RFMID_ROOT, "Training_Set", "Training")),
    ('test', os.path.join(RFMID_ROOT, "Test_Set", "RFMiD_Testing_Labels.csv"),
              os.path.join(RFMID_ROOT, "Test_Set", "Test")),
    ('val', os.path.join(RFMID_ROOT, "Evaluation_Set", "RFMiD_Validation_Labels.csv"),
              os.path.join(RFMID_ROOT, "Evaluation_Set", "Validation"))
]:
    df = pd.read_csv(csv_path)
    df['set'] = set_name
    df['image_folder'] = img_folder
    rfmid_frames.append(df)

rfmid_all = pd.concat(rfmid_frames, ignore_index=True)
rfmid_all['source'] = 'RFMiD'

# Progress for label mapping
tqdm.pandas(desc="Mapping RFMiD labels to ODIR classes")
def rfmid_to_label_vector(row):
    vec = [0]*8
    if row['Disease_Risk'] == 0:
        vec[0] = 1
        return vec
    for col in rfmid_to_odir:
        if row.get(col, 0) == 1:
            odir_class = rfmid_to_odir[col]
            idx = CLASSES.index(odir_class)
            vec[idx] = 1
    if sum(vec) == 0:
        vec[CLASSES.index('O')] = 1
    return vec

rfmid_all['labels'] = rfmid_all.progress_apply(rfmid_to_label_vector, axis=1)

# Progress for image path resolution
tqdm.pandas(desc="Finding RFMiD images")
def get_rfmid_image_path(row):
    base_folder = row['image_folder']
    id_str = str(row['ID'])
    return find_image_file(base_folder, id_str)
rfmid_all['image_path'] = rfmid_all.progress_apply(get_rfmid_image_path, axis=1)
initial_len = len(rfmid_all)
rfmid_all = rfmid_all[rfmid_all['image_path'].notna()]
print(f"RFMiD: found {len(rfmid_all)} images out of {initial_len}")

rfmid_data = rfmid_all[['image_path', 'labels', 'source']].copy()

# ----------------------------------------------------------------------
# 6. Combine datasets
# ----------------------------------------------------------------------
combined = pd.concat([odir_data, rfmid_data], ignore_index=True)
print(f"Total combined images: {len(combined)}")

# ----------------------------------------------------------------------
# 7. Split into train and validation
# ----------------------------------------------------------------------
train_df, val_df = train_test_split(combined, test_size=1-TRAIN_SPLIT, random_state=RANDOM_SEED)

# ----------------------------------------------------------------------
# 8. Create output folders and copy images with progress
# ----------------------------------------------------------------------
os.makedirs(os.path.join(OUTPUT_ROOT, 'train', 'images'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_ROOT, 'val', 'images'), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_ROOT, 'metadata'), exist_ok=True)

def process_image(src, dst, size=(224,224)):
    try:
        img = Image.open(src).convert('RGB')
        img = img.resize(size, Image.Resampling.LANCZOS)
        img.save(dst)
    except Exception as e:
        print(f"Error processing {src}: {e}")

def save_split(df, split_name):
    label_records = []
    # Use tqdm for image processing loop
    for idx, row in tqdm(df.iterrows(), total=len(df), desc=f"Saving {split_name} images"):
        src_path = row['image_path']
        if not os.path.exists(src_path):
            print(f"Warning: {src_path} not found. Skipping.")
            continue
        orig_name = os.path.basename(src_path)
        new_filename = f"{split_name}_{idx}_{orig_name}"
        dst_path = os.path.join(OUTPUT_ROOT, split_name, 'images', new_filename)
        process_image(src_path, dst_path)
        label_records.append({
            'filename': new_filename,
            'labels': row['labels'],
            'source': row['source']
        })
    label_df = pd.DataFrame(label_records)
    if len(label_df) > 0:
        label_df.to_csv(os.path.join(OUTPUT_ROOT, split_name, 'labels.csv'), index=False)
        print(f"Saved {len(label_df)} images to {split_name}")
    else:
        print(f"No valid images for {split_name}. Check paths.")

save_split(train_df, 'train')
save_split(val_df, 'val')

# ----------------------------------------------------------------------
# 9. Save metadata
# ----------------------------------------------------------------------
with open(os.path.join(OUTPUT_ROOT, 'metadata', 'class_names.txt'), 'w') as f:
    for c in CLASSES:
        f.write(c + '\n')

with open(os.path.join(OUTPUT_ROOT, 'metadata', 'rfmid_mapping.json'), 'w') as f:
    json.dump(rfmid_to_odir, f, indent=2)

print("Preprocessing completed.")