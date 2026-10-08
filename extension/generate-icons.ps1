Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
    param([float]$x, [float]$y, [float]$w, [float]$h, [float]$r)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconsDir = Join-Path $dir 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

$c1 = [System.Drawing.Color]::FromArgb(255, 124, 70, 73)     # #7C4649
$c2 = [System.Drawing.Color]::FromArgb(255, 153, 92, 96)     # #995C60
$cream = [System.Drawing.Color]::FromArgb(255, 245, 226, 227) # #F5E2E3

foreach ($size in 16, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = $size * 0.22
    $path = New-RoundedRectPath -x 0.0 -y 0.0 -w $size -h $size -r $radius

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF(0, $size)),
        $c1, $c2)
    $g.FillPath($brush, $path)

    # "Circular" theme: outer ring + center dot.
    $ringPen = New-Object System.Drawing.Pen($cream)
    $ringPen.Width = [Math]::Max(1.0, $size * 0.06)
    $g.DrawEllipse($ringPen, $size * 0.17, $size * 0.17, $size * 0.66, $size * 0.66)

    $centerBrush = New-Object System.Drawing.SolidBrush($cream)
    $dot = $size * 0.10
    $g.FillEllipse($centerBrush, ($size - 2 * $dot) / 2, ($size - 2 * $dot) / 2, 2 * $dot, 2 * $dot)

    $out = Join-Path $iconsDir "icon$size.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated $out"

    $centerBrush.Dispose()
    $ringPen.Dispose()
    $brush.Dispose()
    $path.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

Write-Host 'Done.'