#!/usr/bin/env python3

import csv
import os
from shutil import copyfile

with open('icons.csv') as csvfile:
    reader = csv.reader(csvfile, delimiter=';')
    for row in reader:
        # print(row)
        if os.path.exists(row[0]+'.svg'):
            # print(row[0])
            if os.path.exists(row[1]+'.svg'):
                os.remove(row[1]+'.svg')
            elif os.path.exists(row[1]+'.png'):
                os.remove(row[1]+'.png')
            copyfile(row[0]+'.svg', row[1]+'.svg')
            os.remove(row[0]+'.svg')
