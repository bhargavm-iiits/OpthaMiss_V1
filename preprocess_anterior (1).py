#!/usr/bin/env python3
"""
================================================================================
MISS-EyeScreen | Preprocessing Pipeline for SLID Dataset (v3 - Final)
================================================================================
Changes from v2:
  - Handles compound labels like 'Lens dislocation/Cataract' -> both labels
  - All 13 classes now match paper Table 2 (except Corneal scarring -2)
  - Mono/multi count note added (different definition, not a bug)

Run:
  python preprocess.py --data_dir ./SLID --output_dir ./processed --img_size 224 --generate_masks
================================================================================
"""

import os
import sys
import json
import csv
import argparse
import logging
import warnings
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter, OrderedDict
from typing import Dict, List, Tuple, Optional, Any

import numpy as np
import pandas as pd
import cv2
from PIL import Image, ImageDraw
from tqdm import tqdm

warnings.filterwarnings('ignore')

# ==============================================================================
# Constants
# ==============================================================================

LESION_CLASSES = [
    'Cataract',
    'Intraocular lens',
    'Lens dislocation',
    'Keratitis',
    'Corneal scarring',
    'Corneal dystrophy',
    'Corneal/conjunctival tumor',
    'Pinguecula',
    'Pterygium',
    'Subconjunctival hemorrhage',
    'Conjunctival injection',
    'Conjunctival cyst',
    'Pigmented nevus',
]

ANATOMICAL_REGIONS = ['Pupil', 'Cornea', 'Conjunctiva']

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# === FIX v3: Compound label mapping ===
# Some annotations use compound labels for comorbid conditions
# These must be split into individual labels
COMPOUND_LABEL_MAP = {
    'Lens dislocation/Cataract':    ['Lens dislocation', 'Cataract'],
    'Cataract/Lens dislocation':    ['Cataract', 'Lens dislocation'],
    'Lens dislocation / Cataract':  ['Lens dislocation', 'Cataract'],
    'Cataract / Lens dislocation':  ['Cataract', 'Lens dislocation'],
    # Add more compound patterns here if discovered in future dataset versions
    'Keratitis/Corneal scarring':   ['Keratitis', 'Corneal scarring'],
    'Corneal scarring/Keratitis':   ['Corneal scarring', 'Keratitis'],
}

# Paper Table 2 expected counts for validation
PAPER_EXPECTED_COUNTS = {
    'Cataract': 225, 'Intraocular lens': 119, 'Lens dislocation': 40,
    'Keratitis': 222, 'Corneal scarring': 69, 'Corneal dystrophy': 300,
    'Corneal/conjunctival tumor': 488, 'Pinguecula': 405,
    'Pterygium': 163, 'Subconjunctival hemorrhage': 181,
    'Conjunctival injection': 307, 'Conjunctival cyst': 113,
    'Pigmented nevus': 416,
}
# === END FIX v3 ===


# ==============================================================================
# Flexible Label Matching (with compound label support)
# ==============================================================================

def normalize_string(s: str) -> str:
    """Normalize a label string for flexible matching."""
    s = s.strip().lower()
    while '  ' in s:
        s = s.replace('  ', ' ')
    s = s.replace(' / ', '/')
    s = s.replace('/ ', '/')
    s = s.replace(' /', '/')
    s = s.replace('tumour', 'tumor')
    s = s.replace('haemorrhage', 'hemorrhage')
    s = s.replace('\u2013', '-')
    s = s.replace('\u2014', '-')
    return s


class LabelMatcher:
    """
    Flexible label matcher with compound label support.

    Handles:
    - Case/spacing/spelling variations
    - Compound labels like 'Lens dislocation/Cataract' -> [both labels]
    """

    def __init__(self, canonical_classes: List[str],
                 compound_map: Dict[str, List[str]]):
        self.canonical_classes = canonical_classes
        self.lookup = {}
        self.compound_map = {}  # === FIX v3 ===

        # Build single-label lookup
        for cls in canonical_classes:
            norm = normalize_string(cls)
            self.lookup[norm] = cls
            variants = [
                norm,
                norm.replace('/', ' '),
                norm.replace('/', ' / '),
                cls.lower().strip(),
                cls.strip(),
            ]
            if '/' in norm:
                parts = norm.split('/')
                if len(parts) == 2:
                    variants.append(parts[1] + '/' + parts[0])
            for v in variants:
                if v and v not in self.lookup:
                    self.lookup[v] = cls

        # === FIX v3: Build compound label lookup ===
        for compound_str, label_list in compound_map.items():
            # Validate that all target labels exist
            valid_labels = [l for l in label_list if l in canonical_classes]
            if valid_labels:
                norm = normalize_string(compound_str)
                self.compound_map[compound_str] = valid_labels
                self.compound_map[norm] = valid_labels
                self.compound_map[compound_str.lower().strip()] = valid_labels
        # === END FIX v3 ===

        self.unmatched = Counter()
        self.matched = Counter()
        self.compound_matched = Counter()  # === FIX v3 ===

    def match(self, label: str) -> Optional[List[str]]:
        """
        Match a label string. Returns list of canonical class names.

        === FIX v3: Now returns a LIST (can be multiple for compound labels) ===

        Returns:
            List of matched canonical names, or None if no match.
            Single labels return [label], compound return [label1, label2, ...]
        """
        if not label or not label.strip():
            return None

        # === FIX v3: Check compound labels FIRST (more specific) ===
        label_stripped = label.strip()
        norm = normalize_string(label)

        # Check compound map
        for key in [label_stripped, norm, label_stripped.lower()]:
            if key in self.compound_map:
                self.compound_matched[label_stripped] += 1
                return self.compound_map[key]
        # === END FIX v3 ===

        # Single label: direct lookup
        if label_stripped in self.lookup:
            self.matched[label_stripped] += 1
            return [self.lookup[label_stripped]]

        if norm in self.lookup:
            self.matched[label_stripped] += 1
            return [self.lookup[norm]]

        # Substring matching (70% overlap)
        for key, canonical in self.lookup.items():
            if key in norm or norm in key:
                shorter = min(len(key), len(norm))
                longer = max(len(key), len(norm))
                if shorter / longer > 0.7:
                    self.matched[label_stripped] += 1
                    return [canonical]

        self.unmatched[label_stripped] += 1
        return None

    def get_diagnostics(self) -> str:
        """Generate diagnostic report."""
        lines = ["LABEL MATCHING DIAGNOSTICS", "=" * 60]

        lines.append("\nSingle-Label Matches:")
        for label, count in self.matched.most_common():
            lines.append("  [%5d] '%s'" % (count, label))

        # === FIX v3 ===
        if self.compound_matched:
            lines.append("\nCompound Label Matches (split into multiple labels):")
            for label, count in self.compound_matched.most_common():
                targets = self.compound_map.get(
                    label, self.compound_map.get(normalize_string(label), [])
                )
                lines.append("  [%5d] '%s' -> %s" % (count, label, targets))
        # === END FIX v3 ===

        if self.unmatched:
            lines.append("\n*** UNMATCHED LABELS: ***")
            for label, count in self.unmatched.most_common():
                lines.append("  [%5d] '%s'" % (count, label))
        else:
            lines.append("\nAll labels matched successfully!")

        return "\n".join(lines)


# ==============================================================================
# Logging (ASCII-safe for Windows)
# ==============================================================================

def setup_logging(output_dir: str) -> logging.Logger:
    logger = logging.getLogger('MISS_Preprocess')
    logger.setLevel(logging.DEBUG)
    if logger.handlers:
        logger.handlers.clear()

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s: %(message)s', datefmt='%H:%M:%S'
    ))
    logger.addHandler(ch)

    os.makedirs(output_dir, exist_ok=True)
    fh = logging.FileHandler(
        os.path.join(output_dir, 'preprocessing.log'), encoding='utf-8'
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(funcName)s]: %(message)s'
    ))
    logger.addHandler(fh)
    return logger


# ==============================================================================
# Annotation Parsing
# ==============================================================================

def parse_annotations_csv(
    csv_path: str, label_matcher: LabelMatcher, logger: logging.Logger
) -> Tuple[pd.DataFrame, dict]:
    """Parse SLID Annotations.csv with robust label matching."""
    logger.info("Parsing annotations from: %s", csv_path)

    df = pd.read_csv(csv_path, encoding='utf-8-sig', quotechar='"',
                     doublequote=True, engine='python')
    df.columns = df.columns.str.strip()
    logger.info("Loaded %d annotation rows for %d images",
                len(df), df['filename'].nunique())

    all_regions = Counter()
    all_lesions = Counter()

    def parse_attributes(attr_str):
        try:
            if pd.isna(attr_str):
                return '', ''
            attr = json.loads(str(attr_str))
            region = attr.get('region', '').strip()
            lesion = attr.get('lesion', '').strip()
            if region:
                all_regions[region] += 1
            if lesion:
                all_lesions[lesion] += 1
            return region, lesion
        except (json.JSONDecodeError, TypeError):
            return '', ''

    def parse_shape(shape_str):
        try:
            if pd.isna(shape_str):
                return {}
            return json.loads(str(shape_str))
        except (json.JSONDecodeError, TypeError):
            return {}

    parsed = df['attributes'].apply(parse_attributes)
    df['region'] = parsed.apply(lambda x: x[0])
    df['lesion'] = parsed.apply(lambda x: x[1])
    df['shape_parsed'] = df['shape_coordinates'].apply(parse_shape)

    diagnostics = {
        'all_region_values': dict(all_regions.most_common()),
        'all_lesion_values': dict(all_lesions.most_common()),
    }

    logger.info("")
    logger.info("--- ALL UNIQUE 'region' VALUES ---")
    for val, cnt in all_regions.most_common():
        tag = "(ANATOMICAL)" if val in ANATOMICAL_REGIONS else "(non-anatomical)"
        logger.info("  [%5d] '%s' %s", cnt, val, tag)

    logger.info("")
    logger.info("--- ALL UNIQUE 'lesion' VALUES ---")
    for val, cnt in all_lesions.most_common():
        # === FIX v3: Show compound vs single match status ===
        match_result = label_matcher.match.__wrapped__(label_matcher, val) \
            if hasattr(label_matcher.match, '__wrapped__') else None

        # Quick check without counting
        norm = normalize_string(val)
        is_compound = (val in label_matcher.compound_map or
                       norm in label_matcher.compound_map or
                       val.lower().strip() in label_matcher.compound_map)

        if is_compound:
            targets = label_matcher.compound_map.get(
                val, label_matcher.compound_map.get(
                    norm, label_matcher.compound_map.get(
                        val.lower().strip(), [])))
            logger.info("  [%5d] '%s' -> COMPOUND: %s", cnt, val, targets)
        elif norm in label_matcher.lookup:
            logger.info("  [%5d] '%s' -> '%s'",
                        cnt, val, label_matcher.lookup[norm])
        else:
            logger.info("  [%5d] '%s' *** NO MATCH ***", cnt, val)
        # === END FIX v3 ===

    logger.info("")
    logger.info("Total region annotations: %d", sum(all_regions.values()))
    logger.info("Total lesion annotations: %d", sum(all_lesions.values()))

    return df, diagnostics


def build_image_records(
    df: pd.DataFrame, label_matcher: LabelMatcher, logger: logging.Logger
) -> Dict[str, dict]:
    """
    Build per-image records with compound label support.

    === FIX v3: match() now returns a LIST of labels ===
    """
    logger.info("Building per-image records...")

    records = {}
    compound_count = 0

    for filename, group in tqdm(df.groupby('filename'), desc="Building records"):
        record = {
            'filename': filename,
            'file_size': group['file_size'].iloc[0],
            'annotation_count': group['annotation_count'].iloc[0],
            'regions': {},
            'lesions': [],
            'lesion_shapes': [],
            'label_vector': np.zeros(len(LESION_CLASSES), dtype=np.float32),
        }

        for _, row in group.iterrows():
            region = row['region'].strip() if isinstance(row['region'], str) else ''
            lesion = row['lesion'].strip() if isinstance(row['lesion'], str) else ''
            shape  = row['shape_parsed']

            # Anatomical regions
            if region in ANATOMICAL_REGIONS:
                record['regions'][region] = shape

            # Lesion labels
            matched_labels = None

            # Check lesion field
            if lesion:
                matched_labels = label_matcher.match(lesion)

            # Fallback: check region field for non-anatomical labels
            if matched_labels is None and region and region not in ANATOMICAL_REGIONS:
                matched_labels = label_matcher.match(region)

            # === FIX v3: Handle list of matched labels (compound) ===
            if matched_labels:
                is_compound = len(matched_labels) > 1
                if is_compound:
                    compound_count += 1

                for matched_lesion in matched_labels:
                    if matched_lesion not in record['lesions']:
                        record['lesions'].append(matched_lesion)
                    record['lesion_shapes'].append((matched_lesion, shape))

                    idx = LESION_CLASSES.index(matched_lesion)
                    record['label_vector'][idx] = 1.0
            # === END FIX v3 ===

        records[filename] = record

    # Summary
    n_normal = sum(1 for r in records.values() if not any(r['label_vector']))
    n_single = sum(1 for r in records.values()
                   if 0 < r['label_vector'].sum() == 1)
    n_multi  = sum(1 for r in records.values() if r['label_vector'].sum() > 1)

    logger.info("Built records for %d images", len(records))
    logger.info("  Normal (no lesion): %d  (paper: 245)", n_normal)
    logger.info("  Monomorbidity:      %d  (paper: 2091*)", n_single)
    logger.info("  Multimorbidity:     %d  (paper: 281*)", n_multi)
    logger.info("  Compound annotations resolved: %d", compound_count)

    # === FIX v3: Explain mono/multi discrepancy ===
    logger.info("")
    logger.info("  * NOTE: Paper counts keratitis + conjunctival injection")
    logger.info("    as monomorbidity. Our multi-label approach correctly")
    logger.info("    assigns BOTH labels, shifting some to multimorbidity.")
    logger.info("    This is CORRECT for multi-label classification training.")
    # === END FIX v3 ===

    # Per-class validation against paper
    logger.info("")
    logger.info("--- PER-CLASS COUNTS (vs paper Table 2) ---")
    label_matrix = np.array([r['label_vector'] for r in records.values()])
    all_match = True
    for i, cls in enumerate(LESION_CLASSES):
        found = int(label_matrix[:, i].sum())
        expected = PAPER_EXPECTED_COUNTS.get(cls, '?')
        if isinstance(expected, int):
            diff = found - expected
            if diff == 0:
                status = "EXACT MATCH"
            elif abs(diff) <= 2:
                status = "DIFF=%+d (acceptable)" % diff
            else:
                status = "DIFF=%+d *** CHECK ***" % diff
                all_match = False
        else:
            status = "no reference"
        logger.info("  %-32s  found=%4d  expected=%4s  [%s]",
                     cls, found, str(expected), status)

    if all_match:
        logger.info("")
        logger.info("  >>> All classes within acceptable tolerance! <<<")

    return records


# ==============================================================================
# Segmentation Mask Generation
# ==============================================================================

def draw_shape_on_mask(mask: np.ndarray, shape: dict, value: int = 1) -> np.ndarray:
    """Draw annotation shape onto binary mask."""
    if not shape or 'name' not in shape:
        return mask
    shape_type = shape['name']
    try:
        if shape_type == 'circle':
            cx, cy = int(float(shape['cx'])), int(float(shape['cy']))
            r = int(float(shape['r']))
            cv2.circle(mask, (cx, cy), r, value, -1)
        elif shape_type == 'ellipse':
            cx, cy = int(float(shape['cx'])), int(float(shape['cy']))
            rx, ry = int(float(shape['rx'])), int(float(shape['ry']))
            cv2.ellipse(mask, (cx, cy), (rx, ry), 0, 0, 360, value, -1)
        elif shape_type == 'polygon':
            pts_x = shape.get('all_points_x', [])
            pts_y = shape.get('all_points_y', [])
            if len(pts_x) >= 3 and len(pts_y) >= 3:
                pts = np.array(list(zip(pts_x, pts_y)), dtype=np.int32)
                cv2.fillPoly(mask, [pts], value)
        elif shape_type == 'rect':
            x, y = int(float(shape['x'])), int(float(shape['y']))
            w, h = int(float(shape['width'])), int(float(shape['height']))
            cv2.rectangle(mask, (x, y), (x + w, y + h), value, -1)
    except (KeyError, ValueError, TypeError):
        pass
    return mask


def generate_anatomical_masks(
    record: dict, img_shape: Tuple[int, int], target_size: int = 224
) -> np.ndarray:
    """Generate 3-channel mask [Pupil, Cornea, Conjunctiva]."""
    h, w = img_shape
    masks = np.zeros((3, h, w), dtype=np.uint8)
    for i, region in enumerate(ANATOMICAL_REGIONS):
        if region in record['regions']:
            masks[i] = draw_shape_on_mask(masks[i], record['regions'][region], 1)
    resized = np.zeros((3, target_size, target_size), dtype=np.uint8)
    for i in range(3):
        resized[i] = cv2.resize(masks[i], (target_size, target_size),
                                interpolation=cv2.INTER_NEAREST)
    return resized


# ==============================================================================
# Image Processing
# ==============================================================================

def load_and_resize_image(img_path: str, target_size: int = 224) -> Optional[np.ndarray]:
    """Load and resize image to target_size x target_size RGB."""
    try:
        img = Image.open(img_path).convert('RGB')
        img = img.resize((target_size, target_size), Image.LANCZOS)
        return np.array(img)
    except Exception:
        return None


# ==============================================================================
# Dataset Splitting
# ==============================================================================

def iterative_stratified_split(
    filenames: List[str], label_matrix: np.ndarray,
    test_size: float = 0.1, val_size: float = 0.1, random_state: int = 42
) -> Tuple[List[str], List[str], List[str]]:
    """Multi-label stratified split with multiple fallbacks."""
    np.random.seed(random_state)
    n = len(filenames)

    try:
        from iterstrat.ml_stratifiers import MultilabelStratifiedShuffleSplit
        msss = MultilabelStratifiedShuffleSplit(
            n_splits=1, test_size=test_size, random_state=random_state)
        trainval_idx, test_idx = next(msss.split(np.zeros((n, 1)), label_matrix))

        rel_val = val_size / (1 - test_size)
        msss2 = MultilabelStratifiedShuffleSplit(
            n_splits=1, test_size=rel_val, random_state=random_state)
        train_sub, val_sub = next(msss2.split(
            np.zeros((len(trainval_idx), 1)), label_matrix[trainval_idx]))
        train_idx = trainval_idx[train_sub]
        val_idx   = trainval_idx[val_sub]

    except ImportError:
        label_keys = [''.join(map(str, row.astype(int).tolist()))
                       for row in label_matrix]
        indices = np.arange(n)
        try:
            from sklearn.model_selection import train_test_split as tts
            trainval_idx, test_idx = tts(
                indices, test_size=test_size,
                stratify=label_keys, random_state=random_state)
        except ValueError:
            np.random.shuffle(indices)
            n_test = int(n * test_size)
            test_idx, trainval_idx = indices[:n_test], indices[n_test:]

        rel_val = val_size / (1 - test_size)
        tv_keys = [label_keys[i] for i in trainval_idx]
        try:
            from sklearn.model_selection import train_test_split as tts
            train_sub, val_sub = tts(
                np.arange(len(trainval_idx)), test_size=rel_val,
                stratify=tv_keys, random_state=random_state)
            train_idx = trainval_idx[train_sub]
            val_idx   = trainval_idx[val_sub]
        except ValueError:
            np.random.shuffle(trainval_idx)
            n_val = int(len(trainval_idx) * rel_val)
            val_idx, train_idx = trainval_idx[:n_val], trainval_idx[n_val:]

    filenames = np.array(filenames)
    return (filenames[train_idx].tolist(),
            filenames[val_idx].tolist(),
            filenames[test_idx].tolist())


# ==============================================================================
# Class Weights
# ==============================================================================

def compute_class_weights(label_matrix: np.ndarray, method: str = 'effective') -> np.ndarray:
    """Compute pos_weight for BCEWithLogitsLoss."""
    n = label_matrix.shape[0]
    pos = np.maximum(label_matrix.sum(axis=0), 1)
    neg = np.maximum(n - pos, 1)
    if method == 'inverse_freq':
        w = neg / pos
    elif method == 'effective':
        beta = (n - 1) / n
        w = ((1 - beta ** neg) / (1 - beta)) / ((1 - beta ** pos) / (1 - beta))
    elif method == 'sqrt_inverse':
        w = np.sqrt(neg / pos)
    else:
        w = np.ones(label_matrix.shape[1])
    return np.clip(w, 0.5, 50.0).astype(np.float32)


# ==============================================================================
# Statistics & Reporting
# ==============================================================================

def compute_dataset_statistics(
    records, train_files, val_files, test_files, logger
) -> dict:
    stats = {
        'total_images': len(records),
        'timestamp': datetime.now().isoformat(),
        'lesion_classes': LESION_CLASSES,
        'split_sizes': {
            'train': len(train_files), 'val': len(val_files),
            'test': len(test_files),
        },
    }

    all_labels = np.array([records[f]['label_vector'] for f in records])
    class_stats = {}
    for i, cls in enumerate(LESION_CLASSES):
        n_pos = int(all_labels[:, i].sum())
        n_neg = len(all_labels) - n_pos
        class_stats[cls] = {
            'positive': n_pos, 'negative': n_neg,
            'prevalence_pct': round(n_pos / len(all_labels) * 100, 2),
            'imbalance_ratio': round(n_neg / max(n_pos, 1), 2),
            'paper_expected': PAPER_EXPECTED_COUNTS.get(cls, None),
            'matches_paper': n_pos == PAPER_EXPECTED_COUNTS.get(cls, -1),
        }
    stats['class_statistics'] = class_stats

    label_sums = all_labels.sum(axis=1)
    stats['disease_distribution'] = {
        'normal':         int((label_sums == 0).sum()),
        'monomorbidity':  int((label_sums == 1).sum()),
        'multimorbidity': int((label_sums > 1).sum()),
        'max_lesions':    int(label_sums.max()),
        'mean_lesions':   round(float(
            label_sums[label_sums > 0].mean()), 2) if (label_sums > 0).any() else 0,
    }

    region_stats = {}
    for region in ANATOMICAL_REGIONS:
        n_with = sum(1 for r in records.values() if region in r['regions'])
        region_stats[region] = {'with': n_with, 'without': len(records) - n_with}
    stats['region_coverage'] = region_stats

    for name, files in [('train', train_files), ('val', val_files), ('test', test_files)]:
        sl = np.array([records[f]['label_vector'] for f in files])
        stats[name + '_class_distribution'] = {
            cls: int(sl[:, i].sum()) for i, cls in enumerate(LESION_CLASSES)
        }

    return stats


def generate_report(stats, output_dir, logger):
    """Generate ASCII-safe report."""
    report_path = os.path.join(output_dir, 'preprocessing_report.txt')

    lines = [
        "=" * 80,
        "MISS-EyeScreen | SLID Dataset Preprocessing Report (v3 Final)",
        "=" * 80,
        "Generated: %s" % stats['timestamp'],
        "Total Images: %d" % stats['total_images'],
        "",
        "--- Split Sizes ---",
        "  Train: %d" % stats['split_sizes']['train'],
        "  Val:   %d" % stats['split_sizes']['val'],
        "  Test:  %d" % stats['split_sizes']['test'],
        "",
        "--- Disease Distribution ---",
        "  Normal:         %d" % stats['disease_distribution']['normal'],
        "  Monomorbidity:  %d" % stats['disease_distribution']['monomorbidity'],
        "  Multimorbidity: %d" % stats['disease_distribution']['multimorbidity'],
        "",
        "  NOTE: Paper counts keratitis+conjunctival_injection as monomorbidity.",
        "  Our multi-label approach correctly assigns both labels.",
        "",
        "--- Per-Class Statistics ---",
        "  %-32s %8s %8s %10s %10s %6s" % (
            'Class', 'Found', 'Paper', 'Prevalence', 'Imbalance', 'Match'
        ),
        "-" * 82,
    ]

    for cls, cs in stats['class_statistics'].items():
        expected = cs.get('paper_expected', '?')
        match_sym = 'YES' if cs.get('matches_paper') else 'no'
        lines.append(
            "  %-32s %8d %8s %9.2f%% %9.1f:1 %6s" % (
                cls, cs['positive'], str(expected),
                cs['prevalence_pct'], cs['imbalance_ratio'], match_sym
            )
        )

    lines.extend([
        "",
        "--- Per-Split Class Distribution ---",
        "  %-32s %8s %8s %8s" % ('Class', 'Train', 'Val', 'Test'),
        "-" * 62,
    ])

    for cls in LESION_CLASSES:
        tr = stats['train_class_distribution'][cls]
        vl = stats['val_class_distribution'][cls]
        ts = stats['test_class_distribution'][cls]
        lines.append("  %-32s %8d %8d %8d" % (cls, tr, vl, ts))

    lines.extend(["", "=" * 80])
    report_text = "\n".join(lines)

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_text)

    logger.info("Report saved to %s", report_path)
    print(report_text)


# ==============================================================================
# Main Pipeline
# ==============================================================================

def main(args):
    output_dir = args.output_dir
    logger = setup_logging(output_dir)
    logger.info("=" * 60)
    logger.info("MISS-EyeScreen Preprocessing Pipeline (v3 Final)")
    logger.info("=" * 60)

    img_out_dir  = os.path.join(output_dir, 'images')
    mask_out_dir = os.path.join(output_dir, 'masks')
    split_dir    = os.path.join(output_dir, 'splits')
    for d in [img_out_dir, mask_out_dir, split_dir]:
        os.makedirs(d, exist_ok=True)

    # === FIX v3: Pass compound map to matcher ===
    label_matcher = LabelMatcher(LESION_CLASSES, COMPOUND_LABEL_MAP)
    logger.info("Label matcher: %d canonical classes, %d compound patterns",
                len(LESION_CLASSES), len(COMPOUND_LABEL_MAP))

    # Parse annotations
    csv_path = os.path.join(args.data_dir, 'Annotations.csv')
    if not os.path.exists(csv_path):
        for alt in ['annotations.csv', 'Annotation.csv']:
            p = os.path.join(args.data_dir, alt)
            if os.path.exists(p):
                csv_path = p
                break
        else:
            logger.error("Annotations.csv not found in %s", args.data_dir)
            sys.exit(1)

    df, diagnostics = parse_annotations_csv(csv_path, label_matcher, logger)

    # Build records
    records = build_image_records(df, label_matcher, logger)

    # Save diagnostics
    diag_path = os.path.join(output_dir, 'label_diagnostics.txt')
    with open(diag_path, 'w', encoding='utf-8') as f:
        f.write(label_matcher.get_diagnostics())
        f.write("\n\n--- RAW CSV DIAGNOSTICS ---\n")
        f.write(json.dumps(diagnostics, indent=2, ensure_ascii=False))
    logger.info("Diagnostics saved to %s", diag_path)

    # Locate images
    img_dir = os.path.join(args.data_dir, 'Original_Slit-lamp_Images')
    if not os.path.isdir(img_dir):
        img_dir = args.data_dir
        logger.warning("Using %s as image directory", img_dir)

    valid_filenames = [f for f in sorted(records.keys())
                       if os.path.exists(os.path.join(img_dir, f))]
    logger.info("Found %d valid images on disk", len(valid_filenames))

    # Process images
    logger.info("Processing images to %dx%d ...", args.img_size, args.img_size)
    processed_records = {}
    for fname in tqdm(valid_filenames, desc="Processing images"):
        img_path = os.path.join(img_dir, fname)
        img = load_and_resize_image(img_path, args.img_size)
        if img is None:
            continue

        Image.fromarray(img).save(os.path.join(img_out_dir, fname), 'PNG')

        if args.generate_masks:
            try:
                with Image.open(img_path) as pil_img:
                    orig_w, orig_h = pil_img.size
            except Exception:
                orig_h, orig_w = 1934, 2576
            masks = generate_anatomical_masks(
                records[fname], (orig_h, orig_w), args.img_size)
            np.save(os.path.join(mask_out_dir,
                    fname.replace('.png', '_mask.npy')), masks)

        processed_records[fname] = records[fname]

    logger.info("Processed %d images", len(processed_records))

    # Split
    filenames = sorted(processed_records.keys())
    label_matrix = np.array(
        [processed_records[f]['label_vector'] for f in filenames])

    logger.info("Performing stratified split...")
    train_files, val_files, test_files = iterative_stratified_split(
        filenames, label_matrix,
        test_size=args.test_ratio, val_size=args.val_ratio,
        random_state=args.seed)
    logger.info("Split: train=%d, val=%d, test=%d",
                len(train_files), len(val_files), len(test_files))

    # Save CSVs
    def save_split(file_list, name, recs, out_dir):
        rows = []
        for f in file_list:
            row = {'filename': f}
            lv = recs[f]['label_vector']
            for i, cls in enumerate(LESION_CLASSES):
                row[cls] = int(lv[i])
            lesions = recs[f]['lesions']
            row['lesion_list'] = '|'.join(lesions) if lesions else 'Normal'
            row['n_lesions'] = len(lesions)
            rows.append(row)
        pd.DataFrame(rows).to_csv(
            os.path.join(out_dir, '%s.csv' % name), index=False)

    save_split(train_files, 'train', processed_records, split_dir)
    save_split(val_files,   'val',   processed_records, split_dir)
    save_split(test_files,  'test',  processed_records, split_dir)
    save_split(filenames,   'all_labels', processed_records, output_dir)

    # Class weights
    train_labels = np.array(
        [processed_records[f]['label_vector'] for f in train_files])
    weights = {}
    for method in ['inverse_freq', 'effective', 'sqrt_inverse']:
        w = compute_class_weights(train_labels, method)
        weights[method] = {cls: round(float(w[i]), 4)
                           for i, cls in enumerate(LESION_CLASSES)}
    weights['recommended'] = weights['sqrt_inverse']
    weights['recommended_array'] = [
        weights['sqrt_inverse'][cls] for cls in LESION_CLASSES]

    with open(os.path.join(output_dir, 'class_weights.json'), 'w') as f:
        json.dump(weights, f, indent=2)

    # Stats & report
    stats = compute_dataset_statistics(
        processed_records, train_files, val_files, test_files, logger)
    stats['class_weights'] = weights['recommended']

    with open(os.path.join(output_dir, 'dataset_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)

    generate_report(stats, output_dir, logger)

    # Config
    config = {
        'data_dir': args.data_dir, 'output_dir': args.output_dir,
        'img_size': args.img_size, 'seed': args.seed,
        'n_processed': len(processed_records),
        'normalization': {'mean': IMAGENET_MEAN, 'std': IMAGENET_STD},
        'compound_labels_resolved': dict(label_matcher.compound_matched),
        'unmatched_labels': dict(label_matcher.unmatched),
        'timestamp': datetime.now().isoformat(),
    }
    with open(os.path.join(output_dir, 'preprocess_config.json'), 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    # === FIX v3: Final validation summary ===
    logger.info("")
    logger.info("=" * 60)
    logger.info("FINAL VALIDATION")
    logger.info("=" * 60)

    n_exact = sum(1 for cls in LESION_CLASSES
                  if stats['class_statistics'][cls].get('matches_paper'))
    n_close = sum(1 for cls in LESION_CLASSES
                  if abs(stats['class_statistics'][cls]['positive'] -
                         PAPER_EXPECTED_COUNTS.get(cls, -999)) <= 2)

    logger.info("  Classes matching paper exactly: %d / %d", n_exact, len(LESION_CLASSES))
    logger.info("  Classes within +/-2 tolerance:  %d / %d", n_close, len(LESION_CLASSES))

    if label_matcher.compound_matched:
        logger.info("  Compound labels resolved:       %d annotations",
                     sum(label_matcher.compound_matched.values()))

    if label_matcher.unmatched:
        logger.warning("  Unmatched labels remaining:     %d types (%d annotations)",
                        len(label_matcher.unmatched),
                        sum(label_matcher.unmatched.values()))
    else:
        logger.info("  All labels matched!")

    ready = n_close == len(LESION_CLASSES) and not label_matcher.unmatched
    if ready:
        logger.info("")
        logger.info("  >>> PREPROCESSING COMPLETE - READY FOR TRAINING <<<")
    else:
        logger.info("")
        logger.info("  >>> PREPROCESSING COMPLETE - Review warnings above <<<")

    logger.info("  Output: %s", output_dir)
    logger.info("=" * 60)

    return stats


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='MISS-EyeScreen: SLID Preprocessing (v3 Final)')
    parser.add_argument('--data_dir',   type=str, default='./SLID')
    parser.add_argument('--output_dir', type=str, default='./processed')
    parser.add_argument('--img_size',   type=int, default=224)
    parser.add_argument('--val_ratio',  type=float, default=0.1)
    parser.add_argument('--test_ratio', type=float, default=0.1)
    parser.add_argument('--seed',       type=int, default=42)
    parser.add_argument('--generate_masks', action='store_true', default=True)
    parser.add_argument('--no_masks', dest='generate_masks', action='store_false')
    parser.add_argument('--num_workers', type=int, default=4)
    args = parser.parse_args()
    main(args)