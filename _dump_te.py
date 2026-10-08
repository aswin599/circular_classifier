import sys; sys.argv=['x']
import content_edits as CE
for k, v in CE.TABLE_EDITS.items():
    print("%-8s %s" % (k, v))
